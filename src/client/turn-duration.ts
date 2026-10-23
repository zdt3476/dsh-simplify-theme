/**
 * 回合耗时的展示。
 *
 * 宿主只在「上一轮过程」折叠行里显示用时，回复末尾的操作行没有耗时，翻旧会话时
 * 看不出某一轮跑了多久。这里用会话 running 状态做墙钟计时：本插件观察到会话
 * 从运行变为空闲时，把耗时追加到该轮操作行（`[data-clock="end"]`）的最右侧。
 *
 * 它是观察值而非宿主统计：包含排队与流式等待，和原生折叠行的算法可能差一点。
 */

/** 一百毫秒以内不显示，避免瞬时回合出现 0.0 秒。 */
export const MIN_VISIBLE_MS = 100

/**
 * 格式化耗时。
 * @param ms 毫秒。
 * @param locale 文案函数，供单位用词本地化。
 */
export function formatTurnDuration(ms: number, locale: (key: string) => string): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ${locale('duration.ms')}`
  if (ms < 60_000) {
    const seconds = Math.round(ms / 100) / 10
    return `${seconds} ${locale('duration.s')}`
  }
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.round((ms % 60_000) / 1000)
  return seconds === 0 ? `${minutes} ${locale('duration.m')}` : `${minutes} ${locale('duration.m')} ${seconds} ${locale('duration.s')}`
}

export interface RunningSnapshot {
  byId: Record<string, unknown>
}

export interface TurnDurationOptions {
  /** 会话列表快照源。 */
  sessions: { getSnapshot: () => RunningSnapshot; subscribe: (listener: () => void) => () => void }
  /** 当前展示的会话 id。 */
  currentSessionId: () => string | undefined
  locale: (key: string) => string
  /** 计时来源，默认 Date.now；测试注入。 */
  now?: () => number
}

export interface TurnDurationMount {
  unmount: () => void
}

const TURN_TAIL = '[data-turn-tail]'
const ACTIONS_END = '[data-clock="end"]'
const MARK = 'data-dsh-simplify-duration'
/** 回合结束后 DOM 可能还没渲染完，按这几档延迟重试。 */
const RETRY_DELAYS = [0, 120, 400]

/** 把耗时写进最后一轮操作行的最右侧；该轮还没渲染时返回 null。 */
function paint(duration: string): HTMLElement | null {
  const tails = document.querySelectorAll<HTMLElement>(TURN_TAIL)
  const tail = tails[tails.length - 1]
  const row = tail?.querySelector<HTMLElement>(ACTIONS_END) ?? null
  if (row === null) return null
  let badge = row.querySelector<HTMLElement>(`[${MARK}]`)
  if (badge === null) {
    badge = document.createElement('span')
    badge.setAttribute(MARK, '')
    row.appendChild(badge)
  }
  if (badge.textContent !== duration) badge.textContent = duration
  return badge
}

export function mountTurnDuration(options: TurnDurationOptions): TurnDurationMount | null {
  if (typeof document === 'undefined') return null
  const now = options.now ?? Date.now

  // 每个会话各自计时；切换会话不串数据。
  const startedAt = new Map<string, number>()
  let lastRunning: boolean | undefined
  let lastSessionId: string | undefined

  const apply = () => {
    const sessionId = options.currentSessionId()
    if (sessionId !== lastSessionId) {
      // 换会话：清掉旧徽标，避免耗时挂在别的会话上。
      lastSessionId = sessionId
      lastRunning = undefined
      for (const element of document.querySelectorAll(`[${MARK}]`)) element.remove()
    }
    if (sessionId === undefined) return
    const row = options.sessions.getSnapshot().byId[sessionId] as { running?: boolean } | undefined
    const running = row?.running === true
    if (running === lastRunning) return
    lastRunning = running
    if (running) {
      startedAt.set(sessionId, now())
      return
    }
    const start = startedAt.get(sessionId)
    if (start === undefined) return
    startedAt.delete(sessionId)
    const elapsed = now() - start
    if (elapsed < MIN_VISIBLE_MS) return
    const text = `· ${options.locale('duration.took')} ${formatTurnDuration(elapsed, options.locale)}`
    const pending = [...RETRY_DELAYS]
    const attempt = () => {
      if (paint(text) !== null) return
      const next = pending.shift()
      if (next !== undefined) window.setTimeout(attempt, next)
    }
    attempt()
  }

  const unsubscribe = options.sessions.subscribe(() => {
    try {
      apply()
    } catch (error) {
      console.error('[dsh-simplify-theme] turn duration failed:', error)
    }
  })
  apply()

  return {
    unmount: () => {
      unsubscribe()
      for (const element of document.querySelectorAll(`[${MARK}]`)) element.remove()
    }
  }
}
