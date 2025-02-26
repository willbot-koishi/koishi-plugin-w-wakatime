import { Context, pick, z } from 'koishi'
import {} from '@koishijs/plugin-server'
import {} from 'koishi-plugin-w-echarts'

import { AuthAction, useCheckAuth, extendModels, createAuthAction } from './auth/model'
import { OAuth } from './network/oauth'
import { Api } from './network/api'
import { setupAuthCallback } from './network/authCallback'
import { catchNetworkError } from './network/utils'
import { useWithECharts, stringifyJson } from './utils'
import { PIE_CHART_KEYS, useRenderPieChart } from './chart/pie'

export const name = 'w-wakatime'

export const inject = {
    required: [ 'server', 'http', 'database' ],
    optional: [ 'echarts' ]
}

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
    const withECharts = useWithECharts(ctx)
    const renderPieChart = useRenderPieChart(ctx)

    ctx.command('wakatime')

    ctx.command('wakatime.auth')
        .action(async ({ session }) => {
            if (! session.isDirect) return session.text('.must-be-direct')

            const { id: kid } = await session.observeUser([ 'id' ])

            const [ state ] = await ctx.database.get('w-wakatime-auth-state', kid)
            if (state) return session.text('.already-authorized', { username: state.user.username })

            const authAction = await (async (): Promise<AuthAction> => {
                const [ action ] = await ctx.database.get('w-wakatime-auth-action', kid)
                if (action) {
                    if (action.expiresAt < Date.now())
                        await ctx.database.remove('w-wakatime-auth-action', kid)
                    else
                        return action
                }
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
                {authorizeUrl}<br />
                {session.text('.expires-at', { minutes: (authAction.expiresAt - Date.now()) / (60 * 1000) | 0 })}
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
        .option('graph', '-g')
        .action(async ({ session, options: { range, graph: enableGraph } }) => {
            const state = await checkAuth(session)

            const { data: { data: statsData } } = await ctx
                .http<Api.StatsData>('GET', `${Api.BASE_URL}/users/current/stats/${range}`, {
                    responseType: 'json',
                    headers: Api.getAuthHeaders(state)
                })
                .catch(catchNetworkError(session.text('wakatime.action.getting-stats')))

            const graph = await withECharts(enableGraph, async () => {
                const [ c1, c2, c3, c4 ] = await Promise.all(
                    PIE_CHART_KEYS.map(key => renderPieChart(session, statsData, key))
                )

                return <>{c1}{c2}{c3}{c4}</>
            })

            return <>
                {session.text('.title', pick(statsData, [ 'username', 'human_readable_range' ]))}<br />
                {session.text('.total', pick(statsData, [ 'human_readable_total_including_other_language' ]))}<br />
                {graph}
            </>
        })
}
