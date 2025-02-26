import { Context, HTTP, Session, SessionError, omit, pick, z } from 'koishi'
import {} from '@koishijs/plugin-server'
import { AuthAction, AuthState, useCheckAuth, extendModels, createAuthAction } from './auth/model'
import { OAuth } from './network/oauth'
import { Api } from './network/api'
import { setupAuthCallback } from './network/authCallback'
import { stringifyJson } from './utils'
import { catchNetworkError } from './network/utils'

export const name = 'w-wakatime'

export const inject = [ 'server', 'http', 'database' ]

export interface Config {
    appId: string
    appSecret: string
    selfUrl: string
    authCallbackPath: string
}

export const Config: z<Config> = z.object({
    appId: z.string().required(),
    appSecret: z.string().role('password').required(),
    selfUrl: z.string().required(),
    authCallbackPath: z.string().default('/wakatime/auth'),
})

export function apply(ctx: Context, config: Config) {
    ctx.i18n.define('en-US', require('./locales/en-US.yml'))
    ctx.i18n.define('zh-CN', require('./locales/zh-CN.yml'))

    extendModels(ctx)

    setupAuthCallback(ctx, config)

    const checkAuth = useCheckAuth(ctx)
    const fetchUserData = Api.useFetchUserData(ctx)

    ctx.command('wakatime')

    ctx.command('wakatime.auth')
        .action(async ({ session }) => {

            const { id: kid } = await session.observeUser([ 'id' ])

            const authAction = await (async (): Promise<AuthAction> => {
                const [ action ] = await ctx.database.get('w-wakatime-auth-action', kid)
                if (action) return action
                return await ctx.database.create('w-wakatime-auth-action', createAuthAction(kid))
            })()

            const authorizeUrl = `${OAuth.BASE_URL}/authorize?` + new URLSearchParams({
                client_id: config.appId,
                response_type: 'code',
                redirect_uri: config.selfUrl + config.authCallbackPath,
                state: stringifyJson(pick(authAction, [ 'actionId', 'kid' ])),
                scope: 'read_summaries,read_stats'
            } satisfies OAuth.AuthorizeParam)

            return <>
                {session.text('.visit-link')}<br />
                {authorizeUrl}
            </>
        })
    
    ctx.command('wakatime.auth.revoke')
        .action(async ({ session }) => {
            const state = await checkAuth(session)

            await Promise.all([
                ctx.database.remove('w-wakatime-auth-state', state.kid),
                ctx
                    .http('POST', `${OAuth.BASE_URL}/revoke`, {
                        data: {
                            token: state.token,
                            client_id: config.appId,
                            client_secret: config.appSecret,
                        }
                    })
                    .catch(catchNetworkError(session.text('wakatime.action.revoking-authorization')))
            ])
            return <>{ session.text('.ok') }</>
        })
        
    ctx.command('wakatime.auth.check')
        .action(async ({ session }) => {
            const state = await checkAuth(session)
            const { username } = await fetchUserData({ session, state })

            return <>
                {session.text('.ok', { username })}<br />
                {session.text('.expires-at', { date: new Date(state.expiresAt).toUTCString() })}
            </>
        })

    ctx.command('wakatime.stats')
        .option('range', '-r <range:string>', { fallback: 'last_7_days' })
        .action(async ({ session, options: { range } }) => {
            const state = await checkAuth(session)

            const { data: { data: statsData } } = await ctx
                .http<Api.StatsData>('GET', `${Api.BASE_URL}/users/current/stats/${range}`, {
                    responseType: 'json',
                    headers: Api.getAuthHeaders(state)
                })
                .catch(catchNetworkError(session.text('wakatime.action.getting-stats')))

            return <>
                {session.text('.title', pick(statsData, [ 'username', 'human_readable_range' ]))}<br />
                {session.text('.total', pick(statsData, [ 'human_readable_total_including_other_language' ]))}<br />
            </>
        })
}
