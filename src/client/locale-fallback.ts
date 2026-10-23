/**
 * 文案解析的兜底层。
 *
 * 插件自带中英文字典并注册给宿主 locale；但宿主可能在插件激活前就已绑定命名空间，
 * 或同一命名空间已被旧版本实例注册，导致 `t(key)` 原样返回键名，界面出现
 * `filter.placeholder` 这类内部键。这里补一层：解析失败时用内置文案，
 * 并且只告警一次，避免把问题藏起来。
 */

export interface LocaleBind {
  (key: string, params?: Record<string, string | number>): string
}

export type Translator = (key: string, params?: Record<string, string | number>) => string

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

/**
 * 用内置字典兜住未解析的键。
 * @param bind 宿主提供的命名空间翻译函数。
 * @param fallback 内置字典；解析失败时的文案来源。
 */
export function withFallback(bind: LocaleBind, fallback: Record<string, string>): Translator {
  const warned = new Set<string>()
  return (key, params) => {
    const value = bind(key, params)
    if (value !== undefined && value !== '' && value !== key) return value
    const template = fallback[key]
    if (template === undefined) return value ?? key
    if (!warned.has(key)) {
      warned.add(key)
      console.warn(`[dsh-simplify-theme] locale key "${key}" unresolved by host, using built-in copy`)
    }
    return params === undefined ? template : interpolate(template, params)
  }
}
