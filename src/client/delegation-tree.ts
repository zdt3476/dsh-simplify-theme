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
    modelSelection?: { provider?: string; model?: string }
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

/** 单个会话行 → 委派节点；不是子代理行时返回 null。 */
export function toDelegationNode(id: string, row: SessionRow | undefined, now: number): DelegationNode | null {
  if (row === undefined || row.origin !== 'subagent') return null
  const model = row.projectionValues?.modelSelection?.model
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
