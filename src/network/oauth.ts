import { Dict, z } from 'koishi'
import { parseJsonOrNull, TypedJSON } from '../utils'

export namespace OAuth {
    export const BASE_URL = 'https://wakatime.com/oauth'
    export type AuthorizeParam = {
        client_id: string
        response_type: string
        redirect_uri: string
        state: TypedJSON<AuthorizeState>
        scope?: string
    }

    export type TokenParam = {
        client_id: string
        client_secret: string
        code: string
        grant_type: 'authorization_code'
        redirect_uri: string
    }

    export type TokenDataOk = {
        access_token: string
        refresh_token: string
        uid: string
        token_type: string
        expires_at: string
        expires_in: number
        scope: string
    }

    export type TokenDataErr = {
        error: string
        error_description: string
    }

    export type AuthorizeState = {
        actionId: string
        kid: number
    }

    export type AuthorizeCallbackParamRaw = {
        code: string
        state: string
    }

    export type AuthorizeCallbackParam = {
        code: string
        state: AuthorizeState
    }

    export const AuthorizeState: z<AuthorizeState> = z.object({
        actionId: z.string().required(),
        kid: z.number()
    })

    export const AuthorizeCallbackParam: z<Dict<string | string[]>, AuthorizeCallbackParam> = z.object({
        code: z.string().required(),
        state: z.transform(z.string(), str => AuthorizeState(parseJsonOrNull(str))).required(),
    })

    export type TokenData = TokenDataOk | TokenDataErr

    export type RevokeParam = {
        client_id: string
        client_secret: string
        token: string
    }
}