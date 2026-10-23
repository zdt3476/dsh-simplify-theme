/**
 * 侧栏归档 tabs。
 *
 * DSH 的 WorkspaceBrowser 没有暴露列表上方的 slot，所以这里走 DOM 注入：
 * 在 `[data-slot="sidebar.workspaces"]` 内部、列表区域之前插入一条 React
 * portal 承载的 tab 条。点击第一页写 `archivedFilter: default`，第二页写
 * `only`，都通过 `ctx.uiWorkspace.view` 这个官方写入口完成；tab 高亮从
 * localStorage 的持久化值轮询同步，保证 View options 菜单里的手动切换也能
 * 反映出来。宽窄栏切换由原生布局控制 tab 条的宽度，内容自适应。
 */

import type { ArchivedFilter } from './view-state'
import { VIEW_STORE_KEY, readArchivedFilter } from './view-state'
import { sidebarHeader } from './sidebar-dom'

export interface WorkspaceViewActions {
  setArchivedFilter: (filter: ArchivedFilter) => void
}

export interface WorkspaceService {
  view: WorkspaceViewActions
}

export interface LocaleBind {
  (key: string, params?: Record<string, string | number>): string
}

interface Mount {
  root: HTMLElement
  unmount: () => void
}

const POLL_MS = 400

export interface SidebarTabsOptions {
  locale: LocaleBind
  workspace: () => WorkspaceService
  createElement: (tag: string) => HTMLElement
  React: {
    createElement: unknown
    createRoot: (container: HTMLElement) => { render: (node: unknown) => void; unmount: () => void }
    hooks: ReactHooks
  }
}

interface ReactHooks {
  useState: <S>(init: S | (() => S)) => [S, (next: S | ((prev: S) => S)) => void]
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void
}

interface TabState {
  active: ArchivedFilter
}

/** 生成 tab 条的一次渲染输出；独立成纯函数便于单测。 */
export function tabLabels(t: LocaleBind): { sessions: string; archived: string } {
  return {
    sessions: t('tabs.sessions'),
    archived: t('tabs.archived')
  }
}

export function mountSidebarTabs(options: SidebarTabsOptions): Mount | null {
  const { React, createElement: makeEl } = options
  const anchor = document.querySelector<HTMLElement>('[data-slot="sidebar.workspaces"]')
  // slot 容器由 ui-workspace 的 slot 声明异步渲染；激活期可能还不存在。
  // 短重试兜底，命中即挂；超过上限放弃（下一次插件重载会再试）。
  if (anchor === null) return null
  const header = sidebarHeader(anchor)
  if (header === null) return null
  const container = makeEl('div')
  container.dataset.dshSimplifyTabsHost = ''
  header.insertAdjacentElement('afterend', container)

  const { createElement, createRoot } = React
  const root = createRoot(container)

  const Tabs = () => {
    const [state, setState] = React.hooks.useState<TabState>(() => ({ active: readArchivedFilter(localStorage.getItem(VIEW_STORE_KEY)) }))
    const labels = tabLabels(options.locale)

    ;React.hooks.useEffect(() => {
      const timer = window.setInterval(() => {
        const filter = readArchivedFilter(localStorage.getItem(VIEW_STORE_KEY))
        setState((prev) => (prev.active === filter ? prev : { active: filter }))
      }, POLL_MS)
      return () => window.clearInterval(timer)
    }, [])

    const pick = (filter: ArchivedFilter) => {
      options.workspace().view.setArchivedFilter(filter)
      setState({ active: filter })
    }

    const tab = (filter: ArchivedFilter, label: string) =>
      (createElement as (type: string, props: Record<string, unknown>, ...children: unknown[]) => unknown)(
        'button',
        {
          type: 'button',
          'data-dsh-simplify-tab': '',
          'data-active': state.active === filter ? 'true' : 'false',
          onClick: () => pick(filter)
        },
        label
      )

    return (createElement as (type: string, props: Record<string, unknown>, ...children: unknown[]) => unknown)(
      'div',
      { 'data-dsh-simplify-tabs': '', role: 'tablist' },
      tab('default', labels.sessions),
      tab('only', labels.archived)
    )
  }

  root.render((createElement as (type: unknown) => unknown)(Tabs as unknown as never))

  return {
    root: container,
    unmount: () => {
      root.unmount()
      container.remove()
    }
  }
}
