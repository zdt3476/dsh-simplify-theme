/**
 * 按使用频率给模型选择排序。
 *
 * 两个来源叠加，单位都是「用过几次」：
 *   1. 会话列表快照：每个会话的 `projectionValues.modelSelection` 记一次；
 *   2. 本地记录：每次在这里选择模型时累计（清理历史后仍然有效）。
 *
 * 没有用量数据的供应商和模型保持原有顺序并排在后面——新接入的供应商不该因为
 * "还没人用过"就被打乱位置。
 */

import type { CatalogGroup } from './model-directory'
import type { LocalUsage } from './usage-store'

export interface UsageRank {
  /** 供应商 id → 累计使用次数。 */
  providers: Map<string, number>
  /** `provider/model` → 累计使用次数。 */
  models: Map<string, number>
}

interface UsageRow {
  projectionValues?: {
    modelSelection?: { provider?: string; model?: string } | { next?: { provider?: string; model?: string } | null }
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

function bump(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) ?? 0) + amount)
}

/**
 * 聚合用量：会话计数 + 本地选择次数。
 * @param rows 会话列表的 byId。
 * @param local 本地累计记录。
 */
export function collectUsage(rows: Record<string, UsageRow | undefined>, local: LocalUsage = { providers: {}, models: {} }): UsageRank {
  const providers = new Map<string, number>()
  const models = new Map<string, number>()
  for (const row of Object.values(rows)) {
    if (row === undefined) continue
    const selection = selectionOf(row)
    if (selection === null) continue
    bump(providers, selection.provider, 1)
    bump(models, `${selection.provider}/${selection.model}`, 1)
  }
  for (const [id, count] of Object.entries(local.providers)) bump(providers, id, count)
  for (const [key, count] of Object.entries(local.models)) bump(models, key, count)
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
