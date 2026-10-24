/**
 * 回合内的子代理卡片（一次委派一张）。
 *
 * 参考 PI-Desktop 的单层图思路，但按实际操作粒度落位：每一条 `subagent` 工具
 * 调用就是一次委派，就在它出现的位置插一张卡，不把同一回合的多次委派合并成一张。
 *
 * 数据：会话列表快照里的子会话行（标题、模型、步骤、耗时、运行状态），失败/拒绝
 * 读工具行的 `data-state`。卡片固定宽度、水平居中，避免在宽窗口下拉成一条长横条。
 */

import { toDelegationNode, type DelegationNode, type SessionRows } from './delegation-tree'

const TURN = '[data-chat-turn]'
const TOOL_ROW = '[data-tool]'
const HOST_ATTR = 'data-dsh-simplify-delegations'
/** 被卡片取代的原生工具行。 */
const SOURCE_ATTR = 'data-dsh-simplify-delegation-source'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 委派类工具的 `data-tool` 名称；dsh-tool-subagent 默认叫 subagent。 */
export function isDelegationTool(name: string | null): boolean {
  return name !== null && /(^|[_-])subagent([_-]|$)/i.test(name)
}

/** 一行文本里出现的、确实属于本会话子代理的 id。 */
export function pickSubagentIds(text: string, rows: SessionRows, parentId: string | undefined): string[] {
  const ids: string[] = []
  for (const match of text.matchAll(UUID)) {
    const id = match[0].toLowerCase()
    const row = rows[id]
    if (row === undefined || row.origin !== 'subagent' || row.parentId !== parentId) continue
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

/** 标题拿到的是裸 id 时改用序号，避免卡片上出现 UUID。 */
export function displayTitleOf(node: DelegationNode, index: number): string {
  return UUID_ONLY.test(node.title) ? `子代理 ${index + 1}` : node.title
}

/** 秒/分可读耗时。 */
export function formatDelegationDuration(ms: number, locale: (key: string) => string): string {
  const seconds = Math.round(ms / 100) / 10
  if (seconds < 60) return `${seconds}${locale('duration.s')}`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes}${locale('duration.m')}` : `${minutes}${locale('duration.m')} ${rest}${locale('duration.s')}`
}

export type Abnormal = 'failed' | 'denied' | null

/** 从工具行的错误输出里取一行失败原因；没有就返回 undefined。 */
export function errorReasonOf(row: Element | null, limit = 160): string | undefined {
  const text = row?.querySelector('[data-error]')?.textContent?.trim()
  if (text === undefined || text === '') return undefined
  const line = text.split(/\r?\n/).map((part) => part.trim()).find((part) => part !== '') ?? text
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line
}

/**
 * 一条工具行 → 一张卡要展示的节点。
 * 行的 `data-state` 决定异常态；一次调用只派一个子代理，取第一个可用 id。
 */
export function delegationNodesFor(ids: readonly string[], abnormal: Abnormal, rows: SessionRows, now = Date.now()): DelegationNode[] {
  for (const id of ids) {
    const node = toDelegationNode(id, rows[id], now)
    if (node === null) continue
    return [abnormal === null ? node : { ...node, status: abnormal }]
  }
  return []
}

export interface DelegationPanelOptions {
  sessions: {
    getSnapshot: () => { byId: SessionRows }
    subscribe: (listener: () => void) => () => void
    refreshProjections?: (sessionId: string) => Promise<unknown> | void
  }
  currentSessionId: () => string | undefined
  locale: (key: string, params?: Record<string, string | number>) => string
  openSession: (sessionId: string) => void
  /** 子会话是否可取消（客户端已持有其实例）；为真的运行中卡片显示停止按钮。 */
  canCancel?: (sessionId: string) => boolean
  cancelSession?: (sessionId: string) => void
}

export interface DelegationPanelHandle {
  dispose: () => void
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string>): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
  return node
}

export function mountDelegationPanel(options: DelegationPanelOptions): DelegationPanelHandle | null {
  if (typeof document === 'undefined') return null

  // 工具行 → 卡片宿主，行消失时跟着回收。
  const hosts = new WeakMap<Element, HTMLElement>()
  const refreshed = new Set<string>()
  let ticker: number | undefined
  let frame = 0

  const card = (node: DelegationNode, index: number, reason: string | undefined): HTMLElement => {
    const wrapper = element('div', { [`${HOST_ATTR}-card`]: '', 'data-status': node.status })
    const open = element('button', { type: 'button', 'data-dsh-simplify-delegation-open': '', title: options.locale('delegation.open') })
    const dot = element('span', { 'data-dsh-simplify-delegation-icon': '', 'data-status': node.status, 'aria-hidden': 'true' })
    const body = element('span', { 'data-dsh-simplify-delegation-body': '' })
    const title = element('span', { 'data-dsh-simplify-delegation-title': '' })
    title.textContent = displayTitleOf(node, index)
    const state = element('span', { 'data-dsh-simplify-delegation-state': '', 'data-status': node.status })
    state.textContent = node.status === 'running'
      ? options.locale('delegation.state.running')
      : node.status === 'failed'
        ? options.locale('delegation.state.failed')
        : node.status === 'denied' ? options.locale('delegation.state.denied') : options.locale('delegation.state.done')
    const head = element('span', { 'data-dsh-simplify-delegation-headline': '' })
    head.append(title, state)
    const meta = element('span', { 'data-dsh-simplify-delegation-meta': '' })
    meta.textContent = [
      node.model ?? null,
      node.durationMs === undefined ? null : formatDelegationDuration(node.durationMs, options.locale),
      node.steps === undefined ? null : options.locale('delegation.stepsShort', { count: node.steps })
    ].filter((part): part is string => part !== null && part !== '').join(' · ')
    body.append(head, meta)
    if (reason !== undefined && node.status !== 'running' && node.status !== 'done') {
      const note = element('span', { 'data-dsh-simplify-delegation-reason': '' })
      note.textContent = reason
      note.title = reason
      body.append(note)
    }
    open.append(dot, body)
    open.addEventListener('click', () => options.openSession(node.id))
    wrapper.append(open)
    // 只有客户端确实持有该子会话时才给停止按钮，避免点了没反应。
    if (node.status === 'running' && options.cancelSession !== undefined && options.canCancel?.(node.id) === true) {
      const stop = element('button', { type: 'button', 'data-dsh-simplify-delegation-stop': '', title: options.locale('delegation.stop') })
      stop.textContent = options.locale('delegation.stopLabel')
      stop.addEventListener('click', (event) => {
        event.stopPropagation()
        options.cancelSession?.(node.id)
      })
      wrapper.append(stop)
    }
    return wrapper
  }

  const sync = () => {
    frame = 0
    const parentId = options.currentSessionId()
    const rows = options.sessions.getSnapshot().byId
    const now = Date.now()
    const live = new Set<Element>()
    let running = false
    let index = 0

    for (const turn of document.querySelectorAll(TURN)) {
      const toolRows = [...turn.querySelectorAll<HTMLElement>(TOOL_ROW)].filter((row) => isDelegationTool(row.getAttribute('data-tool')))
      for (const row of toolRows) {
        const ids = pickSubagentIds(row.textContent ?? '', rows, parentId)
        const rawState = row.getAttribute('data-state')
        const abnormal: Abnormal = rawState === 'error' ? 'failed' : rawState === 'denied' ? 'denied' : null
        const nodes = delegationNodesFor(ids, abnormal, rows, now)
        if (nodes.length === 0) continue
        live.add(row)
        if (nodes[0].status === 'running') running = true
        // 插在这次委派自己的位置：紧跟在它所在的聊天节点之后。
        const anchor = row.closest('[data-chat-node-key]') ?? row
        const parent = anchor.parentElement
        if (parent === null) continue
        let host = hosts.get(row)
        if (host === undefined) {
          host = element('div', { [`${HOST_ATTR}-host`]: '' })
          hosts.set(row, host)
        }
        if (host.parentElement !== parent || host.previousElementSibling !== anchor) {
          parent.insertBefore(host, anchor.nextSibling)
        }
        row.setAttribute(SOURCE_ATTR, '')
        const content = card(nodes[0], index++, abnormal === null ? undefined : errorReasonOf(row))
        const signature = `${nodes[0].id}|${nodes[0].status}|${nodes[0].steps ?? -1}|${Math.round((nodes[0].durationMs ?? 0) / 1000)}|${nodes[0].model ?? ''}`
        if (host.dataset.signature !== signature) {
          host.dataset.signature = signature
          host.replaceChildren(content)
        }
      }
    }

    // 宿主回收后解除隐藏。
    for (const row of document.querySelectorAll(`[${SOURCE_ATTR}]`)) {
      if (!live.has(row)) row.removeAttribute(SOURCE_ATTR)
    }

    if (running && ticker === undefined) ticker = window.setInterval(schedule, 1000)
    else if (!running && ticker !== undefined) {
      window.clearInterval(ticker)
      ticker = undefined
    }

    // 刚创建、还没被打开过的子代理可能只有标题：拉一次父会话投影补齐统计。
    const missing = [...live].some((row) => {
      const ids = pickSubagentIds(row.textContent ?? '', rows, parentId)
      const node = ids[0] === undefined ? undefined : toDelegationNode(ids[0], rows[ids[0]], now)
      return node !== undefined && node !== null && node.steps === undefined && node.durationMs === undefined
    })
    if (missing && parentId !== undefined && !refreshed.has(parentId) && options.sessions.refreshProjections !== undefined) {
      refreshed.add(parentId)
      void Promise.resolve(options.sessions.refreshProjections(parentId)).catch(() => refreshed.delete(parentId))
    }
  }

  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      try {
        sync()
      } catch (error) {
        console.error('[dsh-simplify-theme] delegation panel failed:', error)
      }
    })
  }

  const unsubscribe = options.sessions.subscribe(schedule)
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()

  return {
    dispose: () => {
      unsubscribe()
      observer.disconnect()
      if (ticker !== undefined) window.clearInterval(ticker)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      for (const host of document.querySelectorAll(`[${HOST_ATTR}-host]`)) host.remove()
      for (const row of document.querySelectorAll(`[${SOURCE_ATTR}]`)) row.removeAttribute(SOURCE_ATTR)
    }
  }
}
