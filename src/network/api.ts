import { Context, Session, z } from 'koishi'
import { catchNetworkError } from './utils'
import { AuthState, AuthUser, useCheckAuth } from '../auth/model'
import { i18nText } from '../utils'

export namespace Api {
    export const BASE_URL = 'https://wakatime.com/api/v1'

    export const STATS_RANGES = [ 'last_7_days', 'last_30_days', 'last_6_months', 'last_year', 'all_time' ] as const
    export type StatsRange = typeof STATS_RANGES[number]
    export const StatsRange = z.union(STATS_RANGES).default('last_7_days')

    export type Precise = 'minute' | 'second'

    export type Duration<P extends Precise> =
        P extends 'minute' ? { hours: number, minutes: number } :
        P extends 'second' ? { hours: number, minutes: number, seconds: number } :
        never

    export type StatItem<P extends Precise> = {
        name: string
        total_seconds: number
        percent: number
        digital: string
        text: string
    } & Duration<P>
    
    export type StatsData = {
        data: {
            total_seconds: number
            total_seconds_including_other_language: number
            human_readable_total: string
            human_readable_total_including_other_language: string
            daily_average: number
            daily_average_including_other_language: number
            human_readable_daily_average: string
            human_readable_daily_average_including_other_language: string

            categories: StatItem<'minute'>[]
            projects: StatItem<'minute'>[]
            languages: StatItem<'second'>[]
            editors: StatItem<'second'>[]
            operating_systems: StatItem<'second'>[]
            dependencies: StatItem<'second'>[]
            machines: StatItem<'second'>[]

            best_day: {
                date: string
                text: string
                total_seconds: number
            }

            range: string
            human_readable_range: string

            holidays: number
            days_including_holidays: number
            days_minus_holidays: number

            status: string
            percent_calculated: number
            is_already_updating: boolean
            is_coding_activity_visible: boolean
            is_language_usage_visible: boolean
            is_editor_usage_visible: boolean
            is_category_usage_visible: boolean
            is_os_usage_visible: boolean
            is_stuck: boolean
            is_including_today: boolean
            is_up_to_date: boolean

            start: string
            end: string
            timezone: string
            timeout: number

            writes_only: boolean
            user_id: string
            username: string | null
            created_at: string
            modified_at: string
        }
    }

    export const getAuthHeaders = (state: AuthState) => ({
        Authorization: `Bearer ${state.token}`
    })

    export const useFetchUserData = (ctx: Context) => async ({ session, state }: {
        session?: Session
        state?: AuthState
    }): Promise<AuthUser> => {
        state ??= await useCheckAuth(ctx)(session)

        const { data: { data: userData } } = await ctx.http<UserData>('GET', `${BASE_URL}/users/current`, {
            responseType: 'json',
            headers: getAuthHeaders(state)
        }).catch(catchNetworkError(
            i18nText(ctx, session)('wakatime.action.fetching-user-data')
        ))
        
        const user: AuthUser = {
            username: userData.username
        }

        await ctx.database.set('w-wakatime-auth-state', state.kid, { user })

        return user
    }

    export type UserData = {
        data: {
            id: string
            has_premium_features: boolean
            display_name: string
            full_name: string
            email: string
            photo: string
            is_email_public: boolean
            is_email_confirmed: boolean
            public_email: string
            photo_public: boolean
            timezone: string
            last_heartbeat_at: string
            last_plugin: string
            last_plugin_name: string
            last_project: string
            last_branch: string
            plan: string
            username: string
            website: string
            human_readable_website: string
            wonderfuldev_username: string
            github_username: string
            twitter_username: string
            linkedin_username: string
            city: {
                country_code: string
                name: string
                state: string
                title: string
            }
            logged_time_public: boolean
            languages_used_public: boolean
            editors_used_public: boolean
            categories_used_public: boolean
            os_used_public: boolean
            is_hireable: boolean
            created_at: string
            modified_at: string
        }
    }
}