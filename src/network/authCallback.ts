import { Context } from 'koishi'
import { Config } from '..'
import { promiseTry } from '../utils'
import { OAuth } from './oauth'
import { Api } from './api'

class AuthError extends Error {
    name = 'AuthError'
    constructor(public code: number, message: string) {
        super(message)
    }
}

const createCallbackPage = (message: string) => `
<!DOCTYPE html>
<html>
<head>
    <title>Koishi &lt;-&gt; Wakatime</title>
</head>
<body>
    <h1>Koishi &lt;-&gt; Wakatime</h1>
    <p>${message}</p>

    <style>
    body {
        text-align: center;
    }
    </style>
</body>
</html>
`.trim()

export const setupAuthCallback = (ctx: Context, config: Config) => {
    ctx.server.get(config.authCallbackPath, async (ktx) => {
        try {
            const { code, state: { kid, actionId } } = await promiseTry(() => OAuth.AuthorizeCallbackParam(ktx.request.query))
                .catch(() => { throw new AuthError(400, `Bad Request`) })

            const [ authAction ] = await ctx.database.get('w-wakatime-auth-action', kid)
            if (! authAction) throw new AuthError(404, 'Auth action not found')
            if (authAction.actionId !== actionId) throw new AuthError(400, 'Invalid action ID')
            if (authAction.expiresAt < Date.now()) {
                await ctx.database.remove('w-wakatime-auth-action', kid)
                throw new AuthError(410, 'Auth action expired')
            }

            const tokenParam: OAuth.TokenParam = {
                client_id: config.appId,
                client_secret: config.appSecret,
                grant_type: 'authorization_code',
                redirect_uri: config.selfUrl + config.authCallbackPath,
                code
            }

            const { data: tokenForm } = await ctx.http<FormData>('POST', `${OAuth.BASE_URL}/token`, {
                data: tokenParam,
                responseType: 'formdata',
                validateStatus: () => true,
            })
            const tokenData = Object.fromEntries(tokenForm.entries()) as OAuth.TokenData

            if ('error' in tokenData) {
                ctx.logger.error('Token error: %o', tokenData)
                throw new AuthError(400, tokenData.error_description)
            }
            
            Promise.all([
                ctx.database.remove('w-wakatime-auth-action', kid),
                ctx.database.upsert('w-wakatime-auth-state', [{
                    kid,
                    wid: tokenData.uid,
                    token: tokenData.access_token,
                    expiresAt: + new Date(tokenData.expires_at)
                }]),
                Api.useFetchUserData(ctx)({})
            ])

            ktx.status = 200
            ktx.body = createCallbackPage('Auth succeeded')
        }
        catch (err) {
            if (err instanceof AuthError) {
                ktx.status = err.code
                ktx.body = createCallbackPage(err.message)
                return
            }

            ctx.logger.error('Internal error: %o', err)
            ktx.status = 500
            ktx.body = createCallbackPage('Internal Server Error')
        }
    })
}