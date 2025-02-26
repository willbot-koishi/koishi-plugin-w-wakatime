import { Context, Session, SessionError } from 'koishi'
import { AuthState } from './model'

export const checkAuth = (ctx: Context) => async (session: Session): Promise<AuthState> => {
    const { id: kid } = await session.observeUser([ 'id' ])
    const [ state ] = await ctx.database.get('w-wakatime-auth-state', kid)
    if (! state) throw new SessionError('wakatime.error.not-authorized')
    if (state.expiresAt < Date.now()) {
        await ctx.database.remove('w-wakatime-auth-state', state.kid)
        throw new SessionError('wakatime.error.authorization-expired')
    }
    return state
}