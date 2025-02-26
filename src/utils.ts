import { Context, Dict, Session } from 'koishi'

export const promiseTry = async <T>(fn: () => T): Promise<T> => fn()

export const parseJsonOrNull = (str: string): any => {
    try {
        return JSON.parse(str)
    }
    catch {
        return null
    }
}

export type TypedJSON<T> = string & { _jsonType: T }

export const stringifyJson = <T>(value: T) => JSON.stringify(value) as TypedJSON<T>

export const i18nText = (ctx: Context, session?: Session) => (key: string, param?: Dict): string =>
    session?.text(key) ?? ctx.i18n.render(Object.keys(ctx.i18n.locales), [ key ], param).map(String).join('')