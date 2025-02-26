import { HTTP, SessionError } from 'koishi'

export class NetworkError extends SessionError {
    name = 'NetworkError'
    constructor(action: string,  message: string) {
        super('wakatime.error.network-error', { action, message })
    }
}

export const catchNetworkError = (action: string) => ({ response: { status, data } }: HTTP.Error) => {
    throw new NetworkError(action, `${status} ${'error' in data ? data.error : data}`)
}
