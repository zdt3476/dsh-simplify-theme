/**
 * 子代理编排卡片的 DOM 装配。
 *
 * 宿主只在会话头的血缘菜单里展示子代理，聊天流里看不到「主 Agent 协调了谁」。
 * 这里在聊天流顶部注入一张卡片：左侧主 Agent、右侧每个子代理一张小卡，带连接线、
 * 模型、状态、耗时、步骤数——布局参考 PI-Desktop 的 SubagentTopology（单层、
 * 只画真实存在的主 → 子关系，不编造层级）。
 *
 * 数据全部来自会话列表快照，因此卡片是活的：子代理开始、结束时自动更新。
 */

import { collectDelegations, summarizeDelegations, type DelegationNode, type SessionRows } from './delegation-tree'

const FLOW = '[data-chat-flow]'
const HOST_ATTR = 'data-dsh-simplify-delegations'

export interface DelegationPanelOptions {
  sessions: { getSnapshot: () => { byId: SessionRows }; subscribe: (listener: () => void) => () => void }
  currentSessionId: () => string | undefined
  locale: (key: string, params?: Record<string, string | number>) => string
  h: (type: string, props: Record<string, unknown>, ...children: unknown[]) => unknown
  hooks: {
    useState: <S>(init: S | (() => S)) => [S, (next: S | ((prev: S) => S)) => void]
    useSyncExternalStore: <S>(subscribe: (listener: () => void) => () => void, getSnapshot: () => S) => S
  }
  React: { createRoot: (container: HTMLElement) => { render: (node: unknown) => void; unmount: () => void } }
}

export interface DelegationPanelHandle {
  dispose: () => void
}

/** 秒/分/小时的可读耗时，和卡片头的总用时共用。 */
export function formatDelegationDuration(ms: number, locale: (key: string) => string): string {
  const seconds = Math.round(ms / 100) / 10
  if (seconds < 60) return `${seconds}${locale('duration.s')}`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes}${locale('duration.m')}` : `${minutes}${locale('duration.m')} ${rest}${locale('duration.s')}`
}

export function mountDelegationPanel(options: DelegationPanelOptions): DelegationPanelHandle | null {
  if (typeof document === 'undefined') return null
  const { h, hooks } = options

  const Panel = () => {
    const [collapsed, setCollapsed] = hooks.useState(false)
    const rows = hooks.useSyncExternalStore(options.sessions.subscribe, () => options.sessions.getSnapshot().byId)
    const parentId = options.currentSessionId()
    const nodes = collectDelegations(rows, parentId)
    if (nodes.length === 0) return null
    const summary = summarizeDelegations(nodes)

    const status = summary.running > 0
      ? options.locale('delegation.running', { count: summary.running })
      : options.locale('delegation.finished', { count: summary.finished })
    const total = summary.durationMs === 0 ? null : formatDelegationDuration(summary.durationMs, options.locale)

    const node = (child: DelegationNode) =>
      h('li', { 'data-dsh-simplify-delegation-node': '', key: child.id },
        h('span', { 'data-dsh-simplify-delegation-icon': '', 'data-status': child.status, 'aria-hidden': 'true' }),
        h('span', { 'data-dsh-simplify-delegation-body': '' },
          h('span', { 'data-dsh-simplify-delegation-title': '' }, child.title),
          h('span', { 'data-dsh-simplify-delegation-meta': '' },
            child.model === undefined ? null : h('span', { 'data-dsh-simplify-delegation-model': '' }, child.model),
            h('span', { 'data-dsh-simplify-delegation-state': '', 'data-status': child.status }, options.locale(child.status === 'running' ? 'delegation.state.running' : 'delegation.state.done')),
            child.durationMs === undefined ? null : h('span', {}, formatDelegationDuration(child.durationMs, options.locale)),
            child.steps === undefined ? null : h('span', {}, options.locale('delegation.steps', { count: child.steps }))
          )
        )
      )

    return h('section', { [HOST_ATTR]: '', 'data-collapsed': collapsed ? 'true' : 'false' },
      h('button', {
        type: 'button',
        'data-dsh-simplify-delegation-head': '',
        'aria-expanded': collapsed ? 'false' : 'true',
        onClick: () => setCollapsed(value => !value)
      },
      h('span', { 'data-dsh-simplify-delegation-chevron': '', 'aria-hidden': 'true' }),
      h('span', { 'data-dsh-simplify-delegation-heading': '' }, options.locale('delegation.title')),
      h('span', { 'data-dsh-simplify-delegation-summary': '' }, `${status} · ${summary.finished}/${summary.total}`),
      total === null ? null : h('span', { 'data-dsh-simplify-delegation-total': '' }, total)
      ),
      collapsed ? null : h('div', { 'data-dsh-simplify-delegation-graph': '' },
        h('div', { 'data-dsh-simplify-delegation-root': '' },
          h('span', { 'data-dsh-simplify-delegation-root-icon': '', 'aria-hidden': 'true' }),
          h('span', { 'data-dsh-simplify-delegation-root-copy': '' },
            h('strong', {}, options.locale('delegation.agent')),
            h('span', {}, options.locale('delegation.coordinating', { count: summary.total }))
          )
        ),
        h('span', { 'data-dsh-simplify-delegation-connector': '', 'aria-hidden': 'true' }),
        h('ul', { 'data-dsh-simplify-delegation-agents': '', role: 'list' }, nodes.map(node))
      )
    )
  }

  let host: HTMLElement | null = null
  let root: { render: (node: unknown) => void; unmount: () => void } | null = null
  let frame = 0

  const sync = () => {
    const flow = document.querySelector(FLOW)
    // 没有聊天流（新会话空态）时不注入；等有内容再说。
    if (flow === null) {
      if (host !== null) teardown()
      return
    }
    if (host !== null && host.isConnected && host.parentElement === flow && host === flow.firstElementChild) return
    teardown()
    host = document.createElement('div')
    host.setAttribute('data-dsh-simplify-delegation-host', '')
    flow.insertBefore(host, flow.firstElementChild)
    root = options.React.createRoot(host)
    root.render(h(Panel as never, {}))
  }

  const teardown = () => {
    root?.unmount()
    root = null
    host?.remove()
    host = null
  }

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

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()

  return {
    dispose: () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      teardown()
    }
  }
}
