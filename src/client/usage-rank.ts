/**
 * 按使用频率给模型选择排序。
 *
 * 数据来自会话列表快照：每个会话都有 `projectionValues.modelSelection`（当前模型）
 * 和 `projectionValues.tokenUsage`（四桶 token）。把全量会话（含子代理）按
 * 供应商 / 模型聚合，就得到真实的用量分布，不需要额外记录什么。
 *
 * 没有用量数据的供应商和模型保持原有顺序并排在后面——目录里的新供应商不该因为
 * "还没人用过"就被打乱位置。
 */

import type { CatalogGroup } from './model-directory'

export interface UsageRank {
  /** 供应商 id → 累计 token。 */
  providers: Map<string, number>
  /** `provider/model` → 累计 token。 */
  models: Map<string, number>
}

interface UsageRow {
  projectionValues?: {
    modelSelection?: { provider?: string; model?: string } | { next?: { provider?: string; model?: string } | null }
    tokenUsage?: {
      uncachedInputTokens?: number
      outputTokens?: number
      cacheReadTokens?: number
      cacheWriteTokens?: number
    }
  }
}

function selectionOf(row: UsageRow): { provider: string; model: string } | null {
  const selection = row.projectionValues?.modelSelection
  if (selection === undefined || selection === null || typeof selection !== 'object') return null
  const flat = selection as { provider?: unknown; model?: unknown; next?: { provider?: unknown; model?: unknown } | null }
  const candidate = flat.next ?? flat
  const provider = candidate?.provider
  const model = candidate?.model
  return typeof provider === 'string' && provider !== '' && typeof model === 'string' && model !== ''
    ? { provider, model }
    : null
}

function tokensOf(row: UsageRow): number {
  const usage = row.projectionValues?.tokenUsage
  if (usage === undefined) return 0
  return (usage.uncachedInputTokens ?? 0) + (usage.outputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
}

/**
 * 聚合全量会话的用量。
 * @param rows 会话列表的 byId。
 */
export function collectUsage(rows: Record<string, UsageRow | undefined>): UsageRank {
  const providers = new Map<string, number>()
  const models = new Map<string, number>()
  for (const row of Object.values(rows)) {
    if (row === undefined) continue
    const selection = selectionOf(row)
    if (selection === null) continue
    // 一个 token 都没记过的会话也计入「用过一次」，避免新会话权重为 0。
    const weight = Math.max(1, tokensOf(row))
    providers.set(selection.provider, (providers.get(selection.provider) ?? 0) + weight)
    const key = `${selection.provider}/${selection.model}`
    models.set(key, (models.get(key) ?? 0) + weight)
  }
  return { providers, models }
}

/** 有用量按用量降序，没有的保持原序排在后面。 */
function byUsage<T>(items: readonly T[], weight: (item: T) => number): T[] {
  return items
    .map((item, index) => ({ item, index, score: weight(item) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item)
}

/**
 * 给目录排序：供应商按用量降序，每个供应商内的模型也按用量降序。
 * @param groups 已按默认优先级排好的目录分组。
 * @param rank 用量聚合结果。
 */
export function rankCatalog(groups: readonly CatalogGroup[], rank: UsageRank): CatalogGroup[] {
  const scored = byUsage(groups, (group) => rank.providers.get(group.id) ?? 0)
  return scored.map((group) => ({
    ...group,
    models: byUsage(group.models, (model) => rank.models.get(`${group.id}/${model.id}`) ?? 0)
  }))
}
