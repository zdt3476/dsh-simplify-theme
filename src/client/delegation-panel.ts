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

import { toDelegationNode, type DelegationNode, type SessionRow, type SessionRows } from './delegation-tree'

const TURN = '[data-chat-turn]'
const TOOL_ROW = '[data-tool]'
const NODE_KEY = '[data-chat-node-key]'
const HOST_ATTR = 'data-dsh-simplify-delegations'
const SOURCE_ATTR = 'data-dsh-simplify-delegation-source'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isDelegationTool(name: string | null): boolean {
  return name !== null && (/(^|[_-])subagent([_-]|$)/i.test(name) || name === 'spawn_teammate')
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

/**
 * 匹配委派工具行对应的子代理：
 * 1. 显式 UUID 匹配（展开状态、提示词或测试环境携带）。
 * 2. 描述/标题匹配（折叠状态下宿主工具行显示的 description / title）。
 * 3. 时序认领（同父会话下按创建时序推进认领），全局单次认领，避免跨轮或多次重复。
 */
export function matchSubagentId(
  rowText: string,
  rows: SessionRows,
  parentId: string | undefined,
  claimed: ReadonlySet<string>,
  candidateIds?: readonly string[],
  catalogEntries?: ReadonlyArray<{ id: string; label?: string }>
): string | undefined {
  const matchesParent = (p: string | undefined) =>
    parentId === undefined || p === parentId || (p !== undefined && p.replace(/^session-/, '') === parentId.replace(/^session-/, ''))

  // 1. 显式 UUID 优先
  const explicit = pickSubagentIds(rowText, rows, parentId)
  for (const id of explicit) {
    if (!claimed.has(id)) return id
  }

  const candidates: Array<{ id: string; row: SessionRow }> = candidateIds !== undefined
    ? candidateIds
        .map((id) => ({ id, row: rows[id] }))
        .filter((c): c is { id: string; row: SessionRow } => c.row !== undefined && c.row.origin === 'subagent' && matchesParent(c.row.parentId))
    : Object.entries(rows)
        .filter((entry): entry is [string, SessionRow] => entry[1] !== undefined && entry[1].origin === 'subagent' && matchesParent(entry[1].parentId))
        .map(([id, row]) => ({ id, row }))

  // 2. 描述 / 标题包含匹配（支持 SessionRow.displayTitle、title 以及 subagentCatalog 原始 label）
  const labelById = new Map<string, string>()
  if (catalogEntries !== undefined) {
    for (const entry of catalogEntries) {
      if (typeof entry.label === 'string' && entry.label.length >= 2) {
        labelById.set(entry.id, entry.label)
      }
    }
  }

  for (const { id, row } of candidates) {
    if (claimed.has(id)) continue
    const title = row.displayTitle ?? (row as { title?: string }).title ?? labelById.get(id)
    if (typeof title === 'string' && title.length >= 2 && rowText.includes(title)) {
      return id
    }
    const label = labelById.get(id)
    if (label !== undefined && label.length >= 2 && rowText.includes(label)) {
      return id
    }
  }

  // 3. 时序顺序认领
  for (const { id } of candidates) {
    if (!claimed.has(id)) return id
  }

  return undefined
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

export interface BatchCounts {
  total: number
  done: number
  running: number
  failed: number
  denied: number
}

export function batchCounts(members: readonly BatchMember[]): BatchCounts {
  let done = 0
  let running = 0
  let failed = 0
  let denied = 0
  for (const { node } of members) {
    if (node.status === 'running') running += 1
    else if (node.status === 'done') done += 1
    else if (node.status === 'failed') failed += 1
    else denied += 1
  }
  return { total: members.length, done, running, failed, denied }
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
const STEP_PROCESS = '[data-step-process]'
/** 宿主使用相同的 data-chat-turn 值标记同一回合的多个兄弟节点。 */
function turnKeyOf(anchor: Element): string | Element {
  return anchor.closest(TURN)?.getAttribute('data-chat-turn') ?? anchor.closest(STEP_PROCESS) ?? anchor
}

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
  // 主 Agent 的横线固定在主干正中。仅当某个分支几乎就在正中（差 8px 内）时用它，
  // 避免同一高度出现两条平行线；否则保持正中，不吸附到某个子代理分支上。
  const center = (first.y + last.y) / 2
  const nearest = centers.reduce((best, c) => (Math.abs(c.y - center) < Math.abs(best - center) ? c.y : best), first.y)
  const mid = Math.abs(nearest - center) <= 8 ? nearest : center
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

  const hosts = new Map<Element, HTMLElement>()
  const refreshed = new Set<string>()
  const expandedBatches = new WeakSet<HTMLElement>()
  const painters = new Map<HTMLElement, () => void>()
  const claimedByRow = new WeakMap<HTMLElement, string>()
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

  const batchView = (members: BatchMember[], index: number, host: HTMLElement): HTMLElement => {
    const section = el('section', 'subagent-topology')
    section.setAttribute('aria-label', options.locale('delegation.title'))
    const counts = batchCounts(members)

    // 默认只留一行摘要：折叠时仍能看到「这次回复委派了几批、结果如何」。
    const summary = el('button', 'subagent-topology-summary')
    summary.type = 'button'
    const summaryIcon = el('span', 'subagent-topology-summary-icon')
    summaryIcon.setAttribute('aria-hidden', 'true')
    summaryIcon.append(icon(ICON_TARGET, 13))
    const summaryLabel = head(options.locale('delegation.batch', { index }), 'subagent-topology-summary-label')
    const summaryCounts = el('span', 'subagent-topology-summary-counts')
    const parts = [options.locale('delegation.agents', { count: counts.total })]
    if (counts.done > 0) parts.push(`${counts.done} ${options.locale('delegation.state.done')}`)
    if (counts.running > 0) parts.push(`${counts.running} ${options.locale('delegation.state.running')}`)
    summaryCounts.textContent = parts.join(' · ')
    if (counts.failed > 0) {
      const alert = el('span', 'subagent-topology-summary-alert')
      alert.textContent = ` · ${counts.failed} ${options.locale('delegation.state.failed')}`
      summaryCounts.append(alert)
    }
    if (counts.denied > 0) {
      const denied = el('span', 'subagent-topology-summary-alert')
      denied.textContent = ` · ${counts.denied} ${options.locale('delegation.state.denied')}`
      summaryCounts.append(denied)
    }
    const chevron = el('span', 'subagent-topology-summary-chevron')
    chevron.setAttribute('aria-hidden', 'true')
    chevron.append(icon(['M4.5 6.5L8 10l3.5-3.5'], 13))
    summary.append(summaryIcon, summaryLabel, summaryCounts, chevron)

    const detail = el('div', 'subagent-topology-detail')
    const root = el('div', 'subagent-topology-root')
    const rootIcon = el('span', 'subagent-topology-root-icon')
    rootIcon.setAttribute('aria-hidden', 'true')
    rootIcon.append(icon(ICON_TARGET, 16))
    const copy = el('span', 'subagent-topology-root-copy')
    copy.append(head(options.locale('delegation.agent'), ''))
    copy.firstElementChild!.setAttribute('data-dsh-simplify-root-title', '')
    const detailText = el('span')
    detailText.textContent = options.locale('delegation.coordinating', { count: members.length })
    copy.append(detailText)
    root.append(rootIcon, copy)
    const connector = el('span', 'subagent-topology-connector')
    connector.setAttribute('aria-hidden', 'true')
    const agents = el('div', 'subagent-topology-agents')
    agents.setAttribute('role', 'list')
    members.forEach((member, memberIndex) => agents.append(nodeView(member, memberIndex)))
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('data-dsh-simplify-lines', '')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('class', 'subagent-topology-lines')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('fill', 'none')
    svg.append(path)
    agents.append(svg)
    detail.append(root, connector, agents)

    // 连线全部由 paintConnectors 按真实几何绘制；展开后才可测量，隐藏时跳过。
    const repaint = () => {
      if (detail.offsetParent === null) return
      paintConnectors(agents, svg)
    }
    painters.set(host, repaint)

    const apply = (open: boolean) => {
      section.classList.toggle('is-collapsed', !open)
      summary.setAttribute('aria-expanded', String(open))
      summary.title = options.locale(open ? 'delegation.collapse' : 'delegation.expand')
      if (open) window.requestAnimationFrame(repaint)
    }
    apply(expandedBatches.has(host))
    summary.addEventListener('click', () => {
      const open = section.classList.contains('is-collapsed')
      if (open) expandedBatches.add(host)
      else expandedBatches.delete(host)
      apply(open)
    })

    section.append(summary, detail)
    return section
  }

  const sync = () => {
    frame = 0
    const parentId = options.currentSessionId()
    const snapshot = options.sessions.getSnapshot() as {
      byId?: SessionRows
      projectionsBySession?: Record<string, { values?: { subagentCatalog?: Array<{ id: string; label?: string }> } }>
    }
    const rows = snapshot.byId ?? (snapshot as unknown as SessionRows)
    const now = Date.now()
    const live = new Set<Element>()
    const pending: Array<{ anchor: Element; members: BatchMember[] }> = []
    let running = false
    let rowCount = 0

    // 计算当前父会话的子代理有序列表（优先用目录时序）
    const catalogEntries = snapshot.projectionsBySession?.[parentId ?? '']?.values?.subagentCatalog
      ?? (parentId ? snapshot.projectionsBySession?.[parentId.replace(/^session-/, '')]?.values?.subagentCatalog : undefined)
    const catalogIds = (catalogEntries ?? []).map((e) => e.id)
    const matchesParent = (p: string | undefined) =>
      parentId === undefined || p === parentId || (p !== undefined && p.replace(/^session-/, '') === parentId.replace(/^session-/, ''))
    const otherIds = Object.keys(rows).filter((id) => {
      const r = rows[id]
      if (r === undefined || r.origin !== 'subagent') return false
      if (!matchesParent(r.parentId)) return false
      return !catalogIds.includes(id)
    })
    const candidateIds = [...catalogIds, ...otherIds]
    const claimed = new Set<string>()

    // 过滤掉嵌套在其他 [data-chat-turn] 内部的元素，避免外层容器与内层节点重复扫描相同工具行
    const allTurnElements = [...document.querySelectorAll<HTMLElement>(TURN)]
    const turnElements = allTurnElements.filter((el) => el.parentElement?.closest(TURN) === null)

    for (const turn of turnElements) {
      // 按聊天节点顺序切批：连续委派算一批，中间出现别的工具调用就断开。
      const groups: Array<{ anchor: Element; rows: HTMLElement[] }> = []
      let current: { anchor: Element; rows: HTMLElement[] } | null = null
      const nodes = turn.matches(NODE_KEY)
        ? [turn as HTMLElement]
        : [...turn.querySelectorAll<HTMLElement>(NODE_KEY)]
      for (const node of nodes) {
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
      }
      if (current !== null) groups.push(current)

      for (const group of groups) {
        const members: BatchMember[] = []
        const groupRows: HTMLElement[] = []
        const seen = new Set<string>()
        for (const row of group.rows) {
          rowCount += 1
          let matchedId = claimedByRow.get(row)
          if (matchedId === undefined || !candidateIds.includes(matchedId)) {
            matchedId = matchSubagentId(row.textContent ?? '', rows, parentId, claimed, candidateIds, catalogEntries)
            if (matchedId !== undefined) {
              claimedByRow.set(row, matchedId)
            }
          }
          const ids = matchedId !== undefined ? [matchedId] : []
          if (matchedId !== undefined) claimed.add(matchedId)
          const rawState = row.getAttribute('data-state')
          const abnormal: Abnormal = rawState === 'error' ? 'failed' : rawState === 'denied' ? 'denied' : null
          const nodes = delegationNodesFor(ids, abnormal, rows, now)
          // 同一次扇出里同一个子代理只展示一次。
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
        pending.push({ anchor: group.anchor, members })
      }
    }

    // 批次按文档顺序连续递增编号，跨回合保持全局时序递增（第 1 次委派、第 2 次委派…）
    pending.sort((a, b) => (a.anchor.compareDocumentPosition(b.anchor) & 4) !== 0 ? -1 : 1)
    const placed = new Set<Element>()
    let batchIndex = 0
    // 同一折叠组里的多批委派共用一个挂载点，记录上一张图以保持批次顺序。
    const tailOf = new Map<Element, HTMLElement>()
    for (const { anchor, members } of pending) {
      if (placed.has(anchor)) continue
      placed.add(anchor)
      batchIndex += 1
      const index = batchIndex
      // 挂在工作步骤折叠区之外的同一层，折叠工具细节时摘要仍可见。
      const holder = anchor.closest(STEP_PROCESS) ?? anchor
      const parent = holder.parentElement
      if (parent === null) continue
      let host = hosts.get(anchor)
      if (host === undefined) {
        host = el('div', 'subagent-topology-host')
        hosts.set(anchor, host)
      }
      const previous = tailOf.get(holder) ?? holder
      if (host.parentElement !== parent || host.previousElementSibling !== previous) {
        parent.insertBefore(host, previous.nextSibling)
      }
      tailOf.set(holder, host)
      const signature = JSON.stringify([index, members.map(({ node, reason }) => [{ ...node, durationMs: Math.round((node.durationMs ?? 0) / 1000) }, reason])])
      if (host.dataset.signature !== signature) {
        host.dataset.signature = signature
        host.replaceChildren(batchView(members, index, host))
      }
    }

    for (const [anchor, host] of hosts) {
      if (placed.has(anchor)) continue
      host.remove()
      painters.delete(host)
      hosts.delete(anchor)
    }

    for (const row of document.querySelectorAll(`[${SOURCE_ATTR}]`)) {
      if (!live.has(row)) row.removeAttribute(SOURCE_ATTR)
    }
    if (debug) console.info(`[dsh-simplify-theme] 委派图: 工具行 ${rowCount} 条, 已匹配 ${live.size} 条, 会话 ${parentId ?? '未知'}`)

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
    for (const paint of painters.values()) {
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
