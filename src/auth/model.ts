import { Context, Session, SessionError } from 'koishi'

declare module 'koishi' {
    interface Tables {
        'w-wakatime-auth-action': AuthAction
        'w-wakatime-auth-state': AuthState
    }
}

export type Expirable = {
    expiresAt: number
}

export type AuthAction = Expirable & {
    kid: number
    actionId: string
}

export type AuthUser = {
    username: string
}

export type AuthState = Expirable & {
    kid: number
    wid: string
    token: string
    user: AuthUser
}

export const createAuthAction = (kid: number): AuthAction => ({
    kid,
    actionId: Math.random().toString(36).slice(2),
    expiresAt: Date.now() + 5 * 60 * 1000,
})

export const extendModels = (ctx: Context) => {
    ctx.model.extend('w-wakatime-auth-action', {
        kid: 'unsigned',
        actionId: 'string',
        expiresAt: 'unsigned'
    }, {
        primary: 'kid'
    })

    ctx.model.extend('w-wakatime-auth-state', {
        kid: 'unsigned',
        wid: 'string',
        token: 'string',
        expiresAt: 'unsigned',
        user: {
            type: 'object',
            inner: {
                username: 'string'
            }
        }
    }, {
        primary: 'kid' // 1 to n? ([ 'kid', 'wid' ])
    })
}

export const useCheckAuth = (ctx: Context) => async (session: Session): Promise<AuthState> => {
    const { id: kid } = await session.observeUser([ 'id' ])
    const [ state ] = await ctx.database.get('w-wakatime-auth-state', kid)
    if (! state) throw new SessionError('wakatime.error.not-authorized')
    if (state.expiresAt < Date.now()) {
        await ctx.database.remove('w-wakatime-auth-state', state.kid)
        throw new SessionError('wakatime.error.authorization-expired')
    }
    return state
}