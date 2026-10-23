/**
 * 子代理编排卡片的 DOM 装配（按回合）。
 *
 * 参考 PI-Desktop 的 SubagentTopology：单层图，只画真实存在的主 → 子关系。
 * DSH 里子代理是独立会话，委派发生在 `subagent` 工具调用上，因此定位方式是
 * 「回合容器 → 回合内的 subagent 工具行 → 行文本里的子会话 id」，再回会话快照
 * 取标题、模型、步骤、耗时、运行状态；失败态读工具行的 `data-state`。
 *
 * 卡片插在该回合末尾，因此一次会话里多轮委派各有一张，位置与真实发生处一致。
 */

import { toDelegationNode, delegationDuration, type DelegationNode, type SessionRows } from './delegation-tree'

const TURN = '[data-chat-turn]'
const TOOL_ROW = '[data-tool]'
const HOST_ATTR = 'data-dsh-simplify-delegations'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

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

export interface TurnDelegation {
  nodes: DelegationNode[]
  /** 该回合内委派失败的数量，用于卡片头提示。 */
  failed: number
}

/**
 * 把一回合内的工具行归纳成该回合的委派节点。
 *
 * 只在整回合都没有可用 id 时才兜底：按快照顺序补上「此前回合还没认领」的子代理，
 * 避免同一批子代理被每一轮重复画出来。
 * @param claimedAcrossTurns 本次扫描中已分配给更早回合的子代理 id，会被就地更新。
 */
export function turnDelegations(
  rowIds: readonly string[][],
  failedRows: readonly boolean[],
  rows: SessionRows,
  parentId: string | undefined,
  now = Date.now(),
  claimedAcrossTurns: Set<string> = new Set()
): TurnDelegation {
  const nodes: DelegationNode[] = []
  let failed = 0
  let matchedAny = false
  rowIds.forEach((ids, index) => {
    for (const id of ids) {
      if (claimedAcrossTurns.has(id)) continue
      const node = toDelegationNode(id, rows[id], now)
      if (node === null) continue
      claimedAcrossTurns.add(id)
      matchedAny = true
      const isFailed = failedRows[index] === true
      if (isFailed) failed += 1
      nodes.push(isFailed ? { ...node, status: 'failed' } : node)
    }
  })
  if (matchedAny) return { nodes, failed }
  // 兜底：工具行没暴露 id 时，按快照顺序把没画过的子代理补进来。
  for (const [id, row] of Object.entries(rows)) {
    if (row === undefined || row.origin !== 'subagent' || row.parentId !== parentId) continue
    if (claimedAcrossTurns.has(id)) continue
    const node = toDelegationNode(id, rows[id], now)
    if (node === null) continue
    claimedAcrossTurns.add(id)
    nodes.push(node)
  }
  return { nodes, failed }
}

/** 秒/分/小时的可读耗时。 */
export function formatDelegationDuration(ms: number, locale: (key: string) => string): string {
  const seconds = Math.round(ms / 100) / 10
  if (seconds < 60) return `${seconds}${locale('duration.s')}`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes}${locale('duration.m')}` : `${minutes}${locale('duration.m')} ${rest}${locale('duration.s')}`
}

export interface DelegationPanelOptions {
  sessions: {
    getSnapshot: () => { byId: SessionRows }
    subscribe: (listener: () => void) => () => void
    /** 主动拉一次父会话投影；catalog-only 的子会话靠它补齐步骤与耗时。 */
    refreshProjections?: (sessionId: string) => Promise<unknown> | void
  }
  currentSessionId: () => string | undefined
  locale: (key: string, params?: Record<string, string | number>) => string
  /** 点卡片跳到对应子会话。 */
  openSession: (sessionId: string) => void
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

  const renderCard = (turn: Element, delegation: TurnDelegation): void => {
    const { nodes, failed } = delegation
    let host = turn.querySelector<HTMLElement>(`:scope > [${HOST_ATTR}-host]`)
    if (nodes.length === 0) {
      host?.remove()
      return
    }
    if (host === null) {
      host = element('div', { [`${HOST_ATTR}-host`]: '' })
      turn.appendChild(host)
    }
    // 卡片内容变了才重绘；否则观察器会被自己的写入再次触发。
    const signature = JSON.stringify({
      collapsed: host.dataset.collapsed ?? 'false',
      failed,
      nodes: nodes.map((node) => [node.id, node.title, node.model ?? '', node.status, node.steps ?? -1, Math.round((node.durationMs ?? 0) / 1000)])
    })
    if (host.dataset.signature === signature) return
    host.dataset.signature = signature

    const running = nodes.filter((node) => node.status === 'running').length
    const durationMs = nodes.reduce((total, node) => total + (node.durationMs ?? 0), 0)
    const card = element('section', { [HOST_ATTR]: '', 'data-collapsed': host.dataset.collapsed ?? 'false' })
    const head = element('button', {
      type: 'button',
      'data-dsh-simplify-delegation-head': '',
      'aria-expanded': host.dataset.collapsed === 'true' ? 'false' : 'true'
    })
    head.append(element('span', { 'data-dsh-simplify-delegation-chevron': '', 'aria-hidden': 'true' }))
    const heading = element('span', { 'data-dsh-simplify-delegation-heading': '' })
    heading.textContent = options.locale('delegation.title')
    head.append(heading)
    const summary = failed > 0
      ? options.locale('delegation.failed', { count: failed })
      : running > 0
        ? options.locale('delegation.running', { count: running })
        : options.locale('delegation.finished')
    const summaryNode = element('span', { 'data-dsh-simplify-delegation-summary': '', 'data-failed': failed > 0 ? 'true' : 'false' })
    summaryNode.textContent = `${summary} · ${nodes.length - running}/${nodes.length}`
    head.append(summaryNode)
    if (durationMs > 0) {
      const total = element('span', { 'data-dsh-simplify-delegation-total': '' })
      total.textContent = formatDelegationDuration(durationMs, options.locale)
      head.append(total)
    }
    head.addEventListener('click', () => {
      const collapsed = host!.dataset.collapsed === 'true'
      host!.dataset.collapsed = collapsed ? 'false' : 'true'
      card.dataset.collapsed = host!.dataset.collapsed
    })
    card.append(head)

    if (host.dataset.collapsed !== 'true') {
      const graph = element('div', { 'data-dsh-simplify-delegation-graph': '' })
      const root = element('div', { 'data-dsh-simplify-delegation-root': '' })
      root.append(element('span', { 'data-dsh-simplify-delegation-root-icon': '', 'aria-hidden': 'true' }))
      const copy = element('span', { 'data-dsh-simplify-delegation-root-copy': '' })
      const strong = element('strong', {})
      strong.textContent = options.locale('delegation.agent')
      const detail = element('span', {})
      detail.textContent = options.locale('delegation.coordinating', { count: nodes.length })
      copy.append(strong, detail)
      root.append(copy)
      graph.append(root, element('span', { 'data-dsh-simplify-delegation-connector': '', 'aria-hidden': 'true' }))

      const list = element('ul', { 'data-dsh-simplify-delegation-agents': '', role: 'list' })
      for (const node of nodes) {
        const item = element('li', { 'data-dsh-simplify-delegation-node': '', 'data-status': node.status })
        const open = element('button', { type: 'button', 'data-dsh-simplify-delegation-open': '', title: options.locale('delegation.open') })
        open.append(element('span', { 'data-dsh-simplify-delegation-icon': '', 'data-status': node.status, 'aria-hidden': 'true' }))
        const body = element('span', { 'data-dsh-simplify-delegation-body': '' })
        const title = element('span', { 'data-dsh-simplify-delegation-title': '' })
        title.textContent = node.title
        const meta = element('span', { 'data-dsh-simplify-delegation-meta': '' })
        if (node.model !== undefined) {
          const model = element('span', { 'data-dsh-simplify-delegation-model': '' })
          model.textContent = node.model
          meta.append(model)
        }
        const state = element('span', { 'data-dsh-simplify-delegation-state': '', 'data-status': node.status })
        state.textContent = node.status === 'running'
          ? options.locale('delegation.state.running')
          : node.status === 'failed' ? options.locale('delegation.state.failed') : options.locale('delegation.state.done')
        meta.append(state)
        if (node.durationMs !== undefined) {
          const duration = element('span', {})
          duration.textContent = formatDelegationDuration(node.durationMs, options.locale)
          meta.append(duration)
        }
        if (node.steps !== undefined) {
          const steps = element('span', {})
          steps.textContent = options.locale('delegation.steps', { count: node.steps })
          meta.append(steps)
        }
        body.append(title, meta)
        open.append(body)
        open.addEventListener('click', () => options.openSession(node.id))
        item.append(open)
        list.append(item)
      }
      graph.append(list)
      card.append(graph)
    }
    host.replaceChildren(card)
  }

  // 子代理运行中耗时需要每秒走一格；没有运行中的节点时停表。
  let ticker: number | undefined
  const armTicker = (running: boolean) => {
    if (running && ticker === undefined) {
      ticker = window.setInterval(schedule, 1000)
    } else if (!running && ticker !== undefined) {
      window.clearInterval(ticker)
      ticker = undefined
    }
  }

  // 每个父会话只主动拉一次投影，失败后允许重试。
  const refreshed = new Set<string>()

  const sync = () => {
    const parentId = options.currentSessionId()
    const rows = options.sessions.getSnapshot().byId
    const now = Date.now()
    const turns = [...document.querySelectorAll(TURN)]
    // 跨回合共享「已认领」集合：同一个子代理只出现在它所属的回合里。
    const claimed = new Set<string>()
    let anyRunning = false
    let missingProjection = false
    for (const turn of turns) {
      const toolRows = [...turn.querySelectorAll<HTMLElement>(TOOL_ROW)].filter((row) => isDelegationTool(row.getAttribute('data-tool')))
      if (toolRows.length === 0) {
        turn.querySelector(`:scope > [${HOST_ATTR}-host]`)?.remove()
        continue
      }
      const ids = toolRows.map((row) => pickSubagentIds(row.textContent ?? '', rows, parentId))
      const failed = toolRows.map((row) => row.getAttribute('data-state') === 'error' || row.getAttribute('data-state') === 'denied')
      const delegation = turnDelegations(ids, failed, rows, parentId, now, claimed)
      if (delegation.nodes.some((node) => node.status === 'running')) anyRunning = true
      if (delegation.nodes.some((node) => node.steps === undefined && node.durationMs === undefined)) missingProjection = true
      renderCard(turn, delegation)
    }
    armTicker(anyRunning)
    // 刚创建、还没被打开过的子会话可能只有 label：拉一次父会话投影把统计补齐。
    if (missingProjection && parentId !== undefined && !refreshed.has(parentId) && options.sessions.refreshProjections !== undefined) {
      refreshed.add(parentId)
      void Promise.resolve(options.sessions.refreshProjections(parentId)).catch(() => {
        refreshed.delete(parentId)
      })
    }
  }



  let frame = 0
  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
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
    }
  }
}
