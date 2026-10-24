/**
 * 回合内的子代理委派图（复刻 PI-Desktop 的 SubagentTopology）。
 *
 * 结构：左「主 Agent」卡片 → 连接线 → 右侧子代理节点列表（每个节点带状态角标、
 * 名称、模型、状态·耗时、摘要、步数）。
 *
 * 分组：同一回合里连续出现的委派算一批（一次扇出），中间插入了别的工具调用就
 * 另起一张图，避免把不相干的委派粘在一起。
 *
 * 数据来自会话列表快照；失败原因取工具行的错误输出；运行中的节点提供停止按钮。
 */

import { toDelegationNode, type DelegationNode, type SessionRows } from './delegation-tree'

const TURN = '[data-chat-turn]'
const TOOL_ROW = '[data-tool]'
const NODE_KEY = '[data-chat-node-key]'
const HOST_ATTR = 'data-dsh-simplify-delegations'
const SOURCE_ATTR = 'data-dsh-simplify-delegation-source'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isDelegationTool(name: string | null): boolean {
  return name !== null && /(^|[_-])subagent([_-]|$)/i.test(name)
}

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

export function displayTitleOf(node: DelegationNode, index: number): string {
  return UUID_ONLY.test(node.title) ? `子代理 ${index + 1}` : node.title
}

export function formatDelegationDuration(ms: number, locale: (key: string) => string): string {
  const seconds = Math.round(ms / 100) / 10
  if (seconds < 60) return `${seconds}${locale('duration.s')}`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes}${locale('duration.m')}` : `${minutes}${locale('duration.m')} ${rest}${locale('duration.s')}`
}

export type Abnormal = 'failed' | 'denied' | null

export function errorReasonOf(row: Element | null, limit = 160): string | undefined {
  const text = row?.querySelector('[data-error]')?.textContent?.trim()
  if (text === undefined || text === '') return undefined
  const line = text.split(/\r?\n/).map((part) => part.trim()).find((part) => part !== '') ?? text
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line
}

/** 一次工具行 → 一个节点；行的 data-state 决定异常态。 */
export function delegationNodesFor(ids: readonly string[], abnormal: Abnormal, rows: SessionRows, now = Date.now()): DelegationNode[] {
  for (const id of ids) {
    const node = toDelegationNode(id, rows[id], now)
    if (node === null) continue
    return [abnormal === null ? node : { ...node, status: abnormal }]
  }
  return []
}

/** 一批委派的成员：节点 + 失败原因。 */
export interface BatchMember {
  node: DelegationNode
  reason?: string
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
  canCancel?: (sessionId: string) => boolean
  cancelSession?: (sessionId: string) => void
}

export interface DelegationPanelHandle {
  dispose: () => void
}

const SVG_NS = 'http://www.w3.org/2000/svg'
/** 主干左侧预留的间距（与参考实现的 34px 连接列一致）。 */
const GAP = 34

/**
 * 按真实几何画连线：主干 + 每个节点的分支 + 主 Agent 的横线。
 * 用测量的像素坐标绘制，不依赖任何写死偏移，节点高矮不一也不会错开。
 */
export function paintConnectors(agents: HTMLElement, svg: SVGSVGElement): void {
  const box = agents.getBoundingClientRect()
  const nodes = [...agents.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !child.hasAttribute('data-dsh-simplify-lines'))
  if (nodes.length === 0) return
  const centers = nodes.map((node) => {
    const rect = node.getBoundingClientRect()
    return { y: rect.top - box.top + rect.height / 2, left: rect.left - box.left }
  })
  const trunkX = 1
  const first = centers[0]
  const last = centers[centers.length - 1]
  // 主 Agent 的横线落在离主干中点最近的那个分支点上：参考实现里节点等高，
  // 中点正好等于中间节点的分支高度；我们节点高矮不一，必须显式取最近分支，
  // 否则会出现两条相差几像素的平行横线。
  const mid = centers.reduce((best, center) => (Math.abs(center.y - (first.y + last.y) / 2) < Math.abs(best - (first.y + last.y) / 2) ? center.y : best), first.y)
  const width = box.width + GAP
  svg.setAttribute('viewBox', `${-GAP} 0 ${width} ${box.height}`)
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(box.height))
  const d: string[] = [
    // 主 Agent → 主干
    `M ${-GAP + 1} ${mid} H ${trunkX}`,
    // 主干
    `M ${trunkX} ${first.y} V ${last.y}`
  ]
  for (const center of centers) d.push(`M ${trunkX} ${center.y} H ${center.left}`)
  const path = svg.querySelector('path')
  if (path !== null) path.setAttribute('d', d.join(' '))
}

function icon(paths: string[], size: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '1.2')
  svg.setAttribute('aria-hidden', 'true')
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', d)
    svg.append(path)
  }
  return svg
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls !== undefined) node.className = cls
  return node
}

const ICON_TARGET = ['M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2', 'M8 5a3 3 0 100 6 3 3 0 000-6z']
const ICON_BOT = ['M4 5.5h8a1.5 1.5 0 011.5 1.5v4A1.5 1.5 0 0112 12.5H4A1.5 1.5 0 012.5 11V7A1.5 1.5 0 014 5.5z', 'M8 3v2.5', 'M6 8.5h.01M10 8.5h.01']

export function mountDelegationPanel(options: DelegationPanelOptions): DelegationPanelHandle | null {
  if (typeof document === 'undefined') return null

  const hosts = new WeakMap<Element, HTMLElement>()
  const refreshed = new Set<string>()
  const painters = new Set<() => void>()
  let ticker: number | undefined
  let frame = 0
  let debug = false
  try {
    debug = localStorage.getItem('dsh-simplify-theme.debug') === '1'
  } catch {
    debug = false
  }

  const head = (text: string, cls: string): HTMLElement => {
    const span = el('span', cls)
    span.textContent = text
    return span
  }

  const nodeView = (member: BatchMember, index: number): HTMLElement => {
    const { node } = member
    const row = el('div', `subagent-topology-node outcome-${node.status === 'running' ? 'running' : node.status === 'failed' ? 'failed' : node.status === 'denied' ? 'denied' : 'completed'}`)
    row.setAttribute('role', 'listitem')
    const actions = el('div', 'subagent-topology-node-actions')
    const button = el('button', 'subagent-topology-node-header')
    button.type = 'button'
    button.title = [displayTitleOf(node, index), node.model ?? '', member.reason ?? ''].filter(Boolean).join(' · ')
    button.addEventListener('click', () => options.openSession(node.id))

    const avatar = el('span', 'subagent-topology-avatar')
    avatar.setAttribute('aria-hidden', 'true')
    avatar.append(icon(ICON_BOT, 15))
    const statusIcon = el('span', 'subagent-topology-status-icon')
    statusIcon.append(node.status === 'done'
      ? icon(['M4 8.5l2.5 2.5L12 5'], 8)
      : node.status === 'running' ? el('span') : icon(['M8 4.5v4', 'M8 11h.01'], 8))
    avatar.append(statusIcon)

    const copy = el('span', 'subagent-topology-node-copy')
    const titleRow = el('span', 'subagent-topology-node-title-row')
    titleRow.append(head(displayTitleOf(node, index), 'subagent-topology-node-title'))
    if (node.model !== undefined || node.effort !== undefined) {
      const model = el('span', 'subagent-topology-node-model')
      model.title = [node.model ?? '', node.effort ?? ''].filter(Boolean).join(' · ')
      if (node.model !== undefined) model.append(head(node.model, 'subagent-topology-node-model-name'))
      if (node.effort !== undefined) model.append(head(` ${node.effort}`, 'subagent-topology-node-thinking'))
      titleRow.append(model)
    }
    const stateText = node.status === 'running'
      ? options.locale('delegation.state.running')
      : node.status === 'failed'
        ? options.locale('delegation.state.failed')
        : node.status === 'denied' ? options.locale('delegation.state.denied') : options.locale('delegation.state.done')
    const duration = node.durationMs === undefined ? '' : ` · ${formatDelegationDuration(node.durationMs, options.locale)}`
    titleRow.append(head(`${stateText}${duration}`, 'subagent-topology-node-status'))
    copy.append(titleRow)
    if (member.reason !== undefined) copy.append(head(member.reason, 'subagent-topology-node-summary'))
    if (node.steps !== undefined) copy.append(head(options.locale('delegation.steps', { count: node.steps }), 'subagent-topology-node-steps'))
    button.append(avatar, copy)
    if (node.status === 'running') {
      const spinner = el('span', 'subagent-topology-spinner')
      spinner.setAttribute('aria-hidden', 'true')
      button.append(spinner)
    }
    actions.append(button)
    if (node.status === 'running' && options.cancelSession !== undefined && options.canCancel?.(node.id) === true) {
      const stop = el('button', 'subagent-stop-button')
      stop.type = 'button'
      stop.textContent = options.locale('delegation.stopLabel')
      stop.title = options.locale('delegation.stop')
      stop.addEventListener('click', (event) => {
        event.stopPropagation()
        options.cancelSession?.(node.id)
      })
      actions.append(stop)
    }
    row.append(actions)
    return row
  }

  const batchView = (members: BatchMember[]): HTMLElement => {
    const section = el('section', 'subagent-topology')
    section.setAttribute('aria-label', options.locale('delegation.agent'))
    const root = el('div', 'subagent-topology-root')
    const rootIcon = el('span', 'subagent-topology-root-icon')
    rootIcon.setAttribute('aria-hidden', 'true')
    rootIcon.append(icon(ICON_TARGET, 16))
    const copy = el('span', 'subagent-topology-root-copy')
    copy.append(head(options.locale('delegation.agent'), ''))
    copy.firstElementChild!.setAttribute('data-dsh-simplify-root-title', '')
    const detail = el('span')
    detail.textContent = options.locale('delegation.coordinating', { count: members.length })
    copy.append(detail)
    root.append(rootIcon, copy)
    const connector = el('span', 'subagent-topology-connector')
    connector.setAttribute('aria-hidden', 'true')
    const agents = el('div', 'subagent-topology-agents')
    agents.setAttribute('role', 'list')
    members.forEach((member, index) => agents.append(nodeView(member, index)))
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('data-dsh-simplify-lines', '')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('class', 'subagent-topology-lines')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('fill', 'none')
    svg.append(path)
    agents.append(svg)
    section.append(root, connector, agents)
    // 连线全部由 paintConnectors 按真实几何绘制，节点高矮不一也不会错位。
    const repaint = () => paintConnectors(agents, svg)
    painters.add(repaint)
    window.requestAnimationFrame(repaint)
    return section
  }

  const sync = () => {
    frame = 0
    const parentId = options.currentSessionId()
    const rows = options.sessions.getSnapshot().byId
    const now = Date.now()
    const live = new Set<Element>()
    let running = false
    let rowCount = 0
    let fallbacks = 0

    for (const turn of document.querySelectorAll(TURN)) {
      // 按聊天节点顺序切批：连续委派算一批，中间出现别的工具调用就断开。
      const groups: Array<{ anchor: Element; rows: HTMLElement[] }> = []
      let current: { anchor: Element; rows: HTMLElement[] } | null = null
      const claimed = new Set<string>()
      for (const node of turn.querySelectorAll<HTMLElement>(NODE_KEY)) {
        const own = [...node.querySelectorAll<HTMLElement>(TOOL_ROW)].filter((row) => isDelegationTool(row.getAttribute('data-tool')))
        const other = node.querySelectorAll(TOOL_ROW).length > own.length
        if (own.length === 0) {
          if (other && current !== null) {
            groups.push(current)
            current = null
          }
          continue
        }
        current ??= { anchor: node, rows: [] }
        current.rows.push(...own)
        current.anchor = node
      }
      if (current !== null) groups.push(current)

      for (const group of groups) {
        const members: BatchMember[] = []
        const groupRows: HTMLElement[] = []
        const seen = new Set<string>()
        for (const row of group.rows) {
          rowCount += 1
          let ids = pickSubagentIds(row.textContent ?? '', rows, parentId)
          if (ids.length === 0) {
            const orphan = Object.entries(rows).find(([id, candidate]) => candidate !== undefined && candidate.origin === 'subagent' && candidate.parentId === parentId && !claimed.has(id))?.[0]
            if (orphan !== undefined) {
              ids = [orphan]
              fallbacks += 1
            }
          }
          for (const id of ids) claimed.add(id)
          const rawState = row.getAttribute('data-state')
          const abnormal: Abnormal = rawState === 'error' ? 'failed' : rawState === 'denied' ? 'denied' : null
          const nodes = delegationNodesFor(ids, abnormal, rows, now)
          // 同一次扇出里同一个子代理只能出现一次（兜底认领可能重复命中）。
          if (nodes.length === 0 || seen.has(nodes[0].id)) continue
          seen.add(nodes[0].id)
          members.push({ node: nodes[0], ...(abnormal === null ? {} : { reason: errorReasonOf(row) }) })
          groupRows.push(row)
          if (nodes[0].status === 'running') running = true
        }
        if (members.length === 0) continue
        for (const row of groupRows) {
          row.setAttribute(SOURCE_ATTR, '')
          live.add(row)
        }
        const anchor = group.anchor
        const parent = anchor.parentElement
        if (parent === null) continue
        let host = hosts.get(anchor)
        if (host === undefined) {
          host = el('div', 'subagent-topology-host')
          hosts.set(anchor, host)
        }
        if (host.parentElement !== parent || host.previousElementSibling !== anchor) {
          parent.insertBefore(host, anchor.nextSibling)
        }
        const signature = JSON.stringify(members.map(({ node, reason }) => [node.id, node.status, node.model ?? '', node.steps ?? -1, Math.round((node.durationMs ?? 0) / 1000), reason ?? '']))
        if (host.dataset.signature !== signature) {
          host.dataset.signature = signature
          host.replaceChildren(batchView(members))
        }
      }
    }

    for (const row of document.querySelectorAll(`[${SOURCE_ATTR}]`)) {
      if (!live.has(row)) row.removeAttribute(SOURCE_ATTR)
    }
    if (debug) console.info(`[dsh-simplify-theme] 委派图: 工具行 ${rowCount} 条, 兜底 ${fallbacks} 条, 会话 ${parentId ?? '未知'}`)

    if (running && ticker === undefined) ticker = window.setInterval(schedule, 1000)
    else if (!running && ticker !== undefined) {
      window.clearInterval(ticker)
      ticker = undefined
    }

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

  const repaintAll = () => {
    for (const paint of painters) {
      try {
        paint()
      } catch {
        // 节点已被移除时跳过
      }
    }
  }
  window.addEventListener('resize', repaintAll)

  const unsubscribe = options.sessions.subscribe(schedule)
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()

  return {
    dispose: () => {
      unsubscribe()
      observer.disconnect()
      window.removeEventListener('resize', repaintAll)
      if (ticker !== undefined) window.clearInterval(ticker)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      for (const host of document.querySelectorAll('.subagent-topology-host')) host.remove()
      for (const row of document.querySelectorAll(`[${SOURCE_ATTR}]`)) row.removeAttribute(SOURCE_ATTR)
    }
  }
}
