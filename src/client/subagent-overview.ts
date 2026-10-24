/**
 * 子代理总览（与 TODO 同排）。
 *
 * 回合内的编排卡片回答「这一轮派了谁」，这个面板回答「到现在为止一共派了谁、
 * 谁还在跑」。宿主把 TODO 挂在 `conversation.input.dock`，我们注册同一处，
 * 靠样式把两者各占一半。
 *
 * 只读会话列表快照，不额外请求任何数据；点击条目跳到对应子会话。
 */

import { toDelegationNode, type DelegationNode, type SessionRows } from './delegation-tree'
import { displayTitleOf, formatDelegationDuration } from './delegation-panel'

const OUTLET = '[data-slot="conversation.input.dock"]'
const HOST = 'data-dsh-simplify-subagent-overview'

export interface SubagentOverviewOptions {
  sessions: { getSnapshot: () => { byId: SessionRows }; subscribe: (listener: () => void) => () => void }
  currentSessionId: () => string | undefined
  locale: (key: string, params?: Record<string, string | number>) => string
  openSession: (sessionId: string) => void
}

export interface SubagentOverviewHandle {
  dispose: () => void
}

/** 当前会话的全部直接子代理，运行中的排在前面。 */
export function collectChildren(rows: SessionRows, parentId: string | undefined, now = Date.now()): DelegationNode[] {
  if (parentId === undefined) return []
  const nodes: DelegationNode[] = []
  for (const [id, row] of Object.entries(rows)) {
    if (row === undefined || row.parentId !== parentId) continue
    const node = toDelegationNode(id, row, now)
    if (node !== null) nodes.push(node)
  }
  return nodes.sort((left, right) => Number(right.status === 'running') - Number(left.status === 'running'))
}

export function mountSubagentOverview(options: SubagentOverviewOptions): SubagentOverviewHandle | null {
  if (typeof document === 'undefined') return null

  let host: HTMLElement | null = null
  let frame = 0
  let ticker: number | undefined

  const render = (nodes: DelegationNode[]): void => {
    if (host === null) return
    const running = nodes.filter((node) => node.status === 'running').length
    const done = nodes.length - running
    const card = document.createElement('section')
    card.setAttribute(HOST, '')
    card.setAttribute('data-collapsed', host.dataset.collapsed ?? 'true')

    const head = document.createElement('button')
    head.type = 'button'
    head.setAttribute('data-dsh-simplify-overview-head', '')
    head.setAttribute('aria-expanded', host.dataset.collapsed === 'true' ? 'false' : 'true')
    const chevron = document.createElement('span')
    chevron.setAttribute('data-dsh-simplify-overview-chevron', '')
    chevron.setAttribute('aria-hidden', 'true')
    const title = document.createElement('span')
    title.setAttribute('data-dsh-simplify-overview-title', '')
    title.textContent = options.locale('overview.title')
    const summary = document.createElement('span')
    summary.setAttribute('data-dsh-simplify-overview-summary', '')
    summary.textContent = running > 0
      ? options.locale('overview.running', { running, done, total: nodes.length })
      : options.locale('overview.done', { done, total: nodes.length })
    head.append(chevron, title, summary)
    head.addEventListener('click', () => {
      host!.dataset.collapsed = host!.dataset.collapsed === 'true' ? 'false' : 'true'
      card.setAttribute('data-collapsed', host!.dataset.collapsed)
      schedule()
    })
    card.append(head)

    if (host.dataset.collapsed !== 'true') {
      const list = document.createElement('ul')
      list.setAttribute('data-dsh-simplify-overview-list', '')
      list.setAttribute('role', 'list')
      nodes.forEach((node, index) => {
        const item = document.createElement('li')
        item.setAttribute('data-dsh-simplify-overview-item', '')
        item.setAttribute('data-status', node.status)
        const open = document.createElement('button')
        open.type = 'button'
        open.setAttribute('data-dsh-simplify-overview-open', '')
        open.title = options.locale('delegation.open')
        const dot = document.createElement('span')
        dot.setAttribute('data-dsh-simplify-overview-dot', '')
        dot.setAttribute('data-status', node.status)
        dot.setAttribute('aria-hidden', 'true')
        const label = document.createElement('span')
        label.setAttribute('data-dsh-simplify-overview-label', '')
        label.textContent = displayTitleOf(node, index)
        const meta = document.createElement('span')
        meta.setAttribute('data-dsh-simplify-overview-meta', '')
        meta.textContent = [
          node.status === 'running' ? options.locale('delegation.state.running') : node.status === 'failed' ? options.locale('delegation.state.failed') : node.status === 'denied' ? options.locale('delegation.state.denied') : options.locale('delegation.state.done'),
          node.durationMs === undefined ? null : formatDelegationDuration(node.durationMs, options.locale)
        ].filter((part): part is string => part !== null).join(' · ')
        open.append(dot, label, meta)
        open.addEventListener('click', () => options.openSession(node.id))
        item.append(open)
        list.append(item)
      })
      card.append(list)
    }
    host.replaceChildren(card)
    host.setAttribute('data-count', String(nodes.length))
  }

  const sync = () => {
    frame = 0
    const outlet = document.querySelector<HTMLElement>(OUTLET)
    const parentId = options.currentSessionId()
    const nodes = collectChildren(options.sessions.getSnapshot().byId, parentId)
    if (outlet === null || parentId === undefined || nodes.length === 0) {
      host?.remove()
      host = null
      if (ticker !== undefined) {
        window.clearInterval(ticker)
        ticker = undefined
      }
      return
    }
    if (host === null) {
      host = document.createElement('div')
      host.setAttribute('data-dsh-simplify-overview-host', '')
    }
    if (host.parentElement !== outlet) outlet.appendChild(host)
    render(nodes)
    // 有子代理在跑时每秒刷新耗时。
    const running = nodes.some((node) => node.status === 'running')
    if (running && ticker === undefined) ticker = window.setInterval(schedule, 1000)
    else if (!running && ticker !== undefined) {
      window.clearInterval(ticker)
      ticker = undefined
    }
  }

  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      try {
        sync()
      } catch (error) {
        console.error('[dsh-simplify-theme] subagent overview failed:', error)
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
      if (frame !== 0) window.cancelAnimationFrame(frame)
      if (ticker !== undefined) window.clearInterval(ticker)
      host?.remove()
      host = null
    }
  }
}
