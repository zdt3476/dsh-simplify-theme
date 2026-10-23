/**
 * 模型目录的懒加载快照。
 *
 * 目录来自 `ctx.modelDirectories.directoryFor(sessionId)`：store 的快照
 * `{ current, groups, failures, status, pending, error }`，`load()` 幂等。
 * 选择走 `directory.select({ provider, model, reasoningEffort? })`。
 */

import { effortName } from './localize'

export interface ReasoningMeta {
  defaultEffort?: string
  efforts?: ReadonlyArray<{ id: string; name: string }>
}

export interface CatalogModel {
  id: string
  name: string
  reasoning?: ReasoningMeta
}

export interface CatalogGroup {
  id: string
  name: string
  models: CatalogModel[]
}

export interface ModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

export interface DirectorySnapshot {
  current: ModelSelection | null
  groups: CatalogGroup[]
  failures: ReadonlyArray<unknown>
  status: 'idle' | 'loading' | 'ready' | 'error' | 'selecting'
  pending: ModelSelection | null
  error: string | null
  retainedEffort?: string
  routable?: boolean | null
}

export interface ModelDirectory {
  store: {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => DirectorySnapshot
  }
  load: () => Promise<DirectorySnapshot>
  select: (selection: ModelSelection) => Promise<{ ok: boolean; error?: { code: string; message: string } }>
}

export interface ModelDirectories {
  directoryFor: (sessionId: string) => ModelDirectory
}

/** 供应商强调色：按 id 稳定取色，避免供应商增减时颜色互相串位。 */
// 只用非危险色：红色在权限语境里表示完全权限，拿来标供应商会误导。
const PROVIDER_COLORS = [
  'var(--dsw-alias-state-business-primary)',
  'var(--dsw-alias-state-success-primary)',
  'var(--dsw-alias-state-warn-primary)'
]

/**
 * 供应商强调色。
 * @param id 供应商 id；仅在没有序号时用于取色。
 * @param index 供应商在排序后列表中的位置——优先使用，避免两个供应商撞色。
 */
export function providerColor(id: string, index?: number): string {
  if (index !== undefined) return PROVIDER_COLORS[index % PROVIDER_COLORS.length]
  let hash = 0
  for (let position = 0; position < id.length; position += 1) hash = (hash * 31 + id.charCodeAt(position)) % 100000
  return PROVIDER_COLORS[hash % PROVIDER_COLORS.length]
}

/** 深方优先（DeepSeek 账号、官方）再保持目录序，与内置一致。 */
export function orderGroups(groups: readonly CatalogGroup[]): CatalogGroup[] {
  const rank = (id: string) => (id === 'deepseek-account' ? 0 : id === 'deepseek-official' ? 1 : 2)
  return [...groups].sort((left, right) => rank(left.id) - rank(right.id))
}

/** 选中模型在目录里的元数据；丢失目录项时返回 undefined。 */
export function reasoningFor(groups: readonly CatalogGroup[], selection: ModelSelection | null): ReasoningMeta | undefined {
  if (selection === null) return undefined
  return groups.find((group) => group.id === selection.provider)?.models.find((model) => model.id === selection.model)?.reasoning
}

/**
 * 切换模型时沿用原思考档位。
 * @param meta 目标模型的思考元数据。
 * @param previous 切换前的档位 id。
 * @returns 目标模型支持的档位；不支持则回落到该模型的默认档位。
 */
export function retainEffort(meta: ReasoningMeta | undefined, previous: string | undefined): string | undefined {
  if (previous === undefined) return meta?.defaultEffort
  if (meta?.efforts?.some((level) => level.id === previous) === true) return previous
  return meta?.defaultEffort
}

/** 选中项的展示名；目录丢失时回落到模型 id。 */
export function displayName(groups: readonly CatalogGroup[], selection: ModelSelection | null): string {
  if (selection === null) return ''
  const model = groups.find((group) => group.id === selection.provider)?.models.find((model) => model.id === selection.model)
  return model?.name ?? selection.model
}

/**
 * 当前思考等级的展示名。目录元数据缺失时回落到原始 effort id——原生触发器
 * 在这种场景也显示 id，这里保持一致，避免思考等级 pill 无声消失。
 */
export function effortLabel(groups: readonly CatalogGroup[], selection: ModelSelection | null, defaultLabel = '默认', retainedEffort?: string): string | undefined {
  if (selection === null) return undefined
  const meta = reasoningFor(groups, selection)
  const current = selection.reasoningEffort ?? meta?.defaultEffort ?? retainedEffort
  if (current === undefined) return meta === undefined ? undefined : defaultLabel
  return effortName(current, meta?.efforts?.find((level) => level.id === current)?.name)
}

export function effortLevels(meta: ReasoningMeta | undefined, defaultLabel: string): Array<{ id?: string; name: string }> {
  const levels = meta?.efforts
  if (meta === undefined || levels === undefined || levels.length === 0) return []
  const named = levels.map((level) => ({ id: level.id, name: effortName(level.id, level.name) }))
  return meta.defaultEffort === undefined ? [{ name: defaultLabel }, ...named] : named
}
