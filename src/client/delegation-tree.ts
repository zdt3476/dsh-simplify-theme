/**
 * 子代理委派树的纯数据层。
 *
 * 宿主已经把每个子代理当作独立会话登记在会话列表里（`origin: 'subagent'`，
 * `parentId` 指回父会话），并带上 `projectionValues`：模型选择、统计、子代理计时。
 * 这里只做「取哪几行、怎么归纳」，不碰 DOM，便于单测。
 */

export type DelegationStatus = 'running' | 'done' | 'failed'

export interface DelegationNode {
  id: string
  title: string
  model?: string
  status: DelegationStatus
  durationMs?: number
  steps?: number
}

/** 会话列表行的最小形状；宿主字段都是可选的，逐项防御。 */
export interface SessionRow {
  id?: string
  displayTitle?: string
  title?: string
  running?: boolean
  parentId?: string
  origin?: string
  projectionValues?: {
    // 投影线上视图是 { lastUsed, next }；next 才代表当前生效的选择。
    modelSelection?: { provider?: string; model?: string } | { next?: { provider?: string; model?: string } | null }
    sessionStats?: { steps?: number }
    subagentTiming?: { settledMs?: number; active?: { since?: number } }
  }
}

export type SessionRows = Record<string, SessionRow | undefined>

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

export interface SubagentTiming {
  settledMs?: number
  active?: { since?: number }
}

/**
 * 计时口径：已结算毫秒 + 运行中这段已过去的毫秒。
 * @param timing 子代理计时投影。
 * @param now 当前时间；只用于运行中的那一段。
 */
export function delegationDuration(timing: SubagentTiming | undefined, now: number): number | undefined {
  const settled = positive(timing?.settledMs) ?? 0
  const since = positive(timing?.active?.since)
  if (since === undefined) return settled === 0 ? undefined : settled
  return settled + Math.max(0, now - since)
}

/** 模型名字：兼容 { next } 视图与扁平的 { model } 两种形状。 */
export function selectionModel(selection: { model?: string; next?: { model?: string } | null } | undefined): string | undefined {
  if (selection === null || selection === undefined || typeof selection !== 'object') return undefined
  const flat = selection as { model?: unknown }
  if (typeof flat.model === 'string' && flat.model !== '') return flat.model
  const next = (selection as { next?: { model?: unknown } | null }).next
  const model = next?.model
  return typeof model === 'string' && model !== '' ? model : undefined
}

/** 单个会话行 → 委派节点；不是子代理行时返回 null。 */
export function toDelegationNode(id: string, row: SessionRow | undefined, now: number): DelegationNode | null {
  if (row === undefined || row.origin !== 'subagent') return null
  const model = selectionModel(row.projectionValues?.modelSelection)
  return {
    id,
    title: row.displayTitle ?? row.title ?? id,
    ...(model === undefined || model === '' ? {} : { model }),
    status: row.running === true ? 'running' : 'done',
    ...((): { durationMs?: number } => {
      const duration = delegationDuration(row.projectionValues?.subagentTiming, now)
      return duration === undefined ? {} : { durationMs: duration }
    })(),
    ...((): { steps?: number } => {
      const steps = positive(row.projectionValues?.sessionStats?.steps)
      return steps === undefined ? {} : { steps }
    })()
  }
}
