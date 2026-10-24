/**
 * 本地使用记录。
 *
 * 会话快照只能反映「还在列表里的会话」，清理历史后权重会一起消失。这里在
 * localStorage 里额外累计每次选择的次数，和会话统计叠加，排序更稳定。
 * 只记录「选了哪个供应商/模型」，不涉及任何对话内容。
 */

export const USAGE_KEY = 'dsh-simplify-theme.usage'

export interface LocalUsage {
  providers: Record<string, number>
  models: Record<string, number>
}

const EMPTY: LocalUsage = { providers: {}, models: {} }

/** 解析持久化值；任何异常都按空记录处理。 */
export function parseUsage(raw: string | null): LocalUsage {
  if (raw === null) return EMPTY
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return EMPTY
    const source = parsed as { providers?: unknown; models?: unknown }
    return { providers: counters(source.providers), models: counters(source.models) }
  } catch {
    return EMPTY
  }
}

function counters(value: unknown): Record<string, number> {
  if (value === null || typeof value !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, count] of Object.entries(value as Record<string, unknown>)) {
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) out[key] = count
  }
  return out
}

/** 累计一次选择；返回新对象，不改入参。 */
export function addUsage(state: LocalUsage, provider: string, model: string): LocalUsage {
  const key = `${provider}/${model}`
  return {
    providers: { ...state.providers, [provider]: (state.providers[provider] ?? 0) + 1 },
    models: { ...state.models, [key]: (state.models[key] ?? 0) + 1 }
  }
}

export function readLocalUsage(): LocalUsage {
  if (typeof localStorage === 'undefined') return EMPTY
  return parseUsage(localStorage.getItem(USAGE_KEY))
}

export function recordLocalUsage(provider: string, model: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(addUsage(readLocalUsage(), provider, model)))
  } catch {
    // 存储写满或被禁用时放弃记录：排序退回会话统计，不影响选择本身。
  }
}
