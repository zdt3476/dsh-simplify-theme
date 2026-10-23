/**
 * 侧栏工作区列表的渐进披露：活跃排序、折叠、置顶、会话数徽标。
 *
 * DSH 没有工作区级的 pin，也没有「只显示前 N 个工作区」的开关，所以全部在
 * DOM 层做（与 tabs/筛选同一套注入策略）：
 *   - 折叠：给超出 N 的组打 `data-dsh-simplify-collapsed`，样式表负责隐藏；
 *   - 置顶：给组打 `data-dsh-simplify-pinned`，列表容器改 flex column 后用 order 提前；
 *   - 徽标：把会话数写进工作区行的属性，样式表用 ::after + attr() 渲染。
 * 原生拖拽/动画继续按自己的节点工作，我们只改属性与顺序，不动 DOM 结构。
 */

import type { ArchivedFilter } from './view-state'
import { orderWorkspaceGroups, workspaceActivity } from './sidebar-activity'
import type { ActivityStore, SessionActivitySnapshot, WorkspaceActivitySnapshot } from './sidebar-activity'

export const PINNED_KEY = 'dsh-simplify-theme.pinned-workspaces'
export const EXPANDED_KEY = 'dsh-simplify-theme.workspaces-expanded'
export const COLLAPSED_LIMIT = 5

export interface GroupInfo {
  id: string
  pinned: boolean
}

/** 解析置顶列表；异常一律按空列表处理。 */
export function parsePinned(raw: string | null): string[] {
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/**
 * 折叠后应保持可见的组：置顶始终可见，其余取排序后的前 `limit` 个。
 */
export function visibleGroupIds(groups: readonly GroupInfo[], limit = COLLAPSED_LIMIT): Set<string> {
  const visible = new Set<string>()
  let ordinary = 0
  for (const group of groups) {
    if (group.pinned) {
      visible.add(group.id)
      continue
    }
    if (ordinary < limit) {
      visible.add(group.id)
      ordinary += 1
    }
  }
  return visible
}

/** 折叠按钮文案：还有多少个组被收起。 */
export function hiddenCount(groups: readonly GroupInfo[], limit = COLLAPSED_LIMIT): number {
  const visible = visibleGroupIds(groups, limit)
  return groups.filter((group) => !visible.has(group.id)).length
}

export interface SidebarGroupsOptions {
  locale: (key: string, params?: Record<string, string | number>) => string
  createElement: (tag: string) => HTMLElement
  /** 读取当前归档过滤，归档页不做折叠（否则「已归档」页会空）。 */
  archivedFilter: () => ArchivedFilter
  workspaces: ActivityStore<WorkspaceActivitySnapshot>
  sessions: ActivityStore<SessionActivitySnapshot>
}

export interface SidebarGroupsMount {
  unmount: () => void
}

const SLOT_SELECTOR = '[data-slot="sidebar.workspaces"]'
const WORKSPACE_ROW = '[data-row-key^="workspace:"]'
const SESSION_ROW = '[data-row-key^="session"]'

interface GroupHandle {
  id: string
  element: HTMLElement
  row: HTMLElement
}

function collectGroups(slot: Element): GroupHandle[] {
  const handles: GroupHandle[] = []
  for (const row of slot.querySelectorAll<HTMLElement>(WORKSPACE_ROW)) {
    // 工作区行 → 行的包裹 span → 组容器；组容器内只能有这一个工作区行。
    const element = row.parentElement?.parentElement as HTMLElement | null
    if (element === null) continue
    if (element.querySelectorAll(WORKSPACE_ROW).length !== 1) continue
    const id = (row.getAttribute('data-row-key') ?? '').replace('workspace:', '')
    if (id === '') continue
    handles.push({ id, element, row })
  }
  return handles
}

export function mountSidebarGroups(options: SidebarGroupsOptions): SidebarGroupsMount | null {
  const slot = document.querySelector(SLOT_SELECTOR)
  if (slot === null) return null

  const pinned = new Set(parsePinned(localStorage.getItem(PINNED_KEY)))
  let expanded = localStorage.getItem(EXPANDED_KEY) === '1'

  const header = slot.querySelector('button[aria-label*="搜索"], button[aria-label*="Search"]')?.parentElement?.parentElement?.parentElement ?? null
  const controls = options.createElement('div')
  controls.dataset.dshSimplifyGroupsControls = ''
  if (header !== null) header.appendChild(controls)

  const toggle = options.createElement('button') as HTMLButtonElement
  toggle.type = 'button'
  toggle.dataset.dshSimplifyGroupsToggle = ''
  controls.appendChild(toggle)

  const pinButton = options.createElement('button') as HTMLButtonElement
  pinButton.type = 'button'
  pinButton.dataset.dshSimplifyPinToggle = ''
  pinButton.textContent = options.locale('groups.pin')
  pinButton.title = options.locale('groups.pinHint')
  controls.appendChild(pinButton)

  const panel = options.createElement('div')
  panel.dataset.dshSimplifyPinPanel = ''
  panel.hidden = true
  controls.appendChild(panel)

  const persistPinned = () => localStorage.setItem(PINNED_KEY, JSON.stringify([...pinned]))

  const renderPanel = (groups: GroupHandle[]) => {
    panel.replaceChildren()
    for (const group of groups) {
      const item = options.createElement('button') as HTMLButtonElement
      item.type = 'button'
      item.dataset.dshSimplifyPinItem = group.id
      item.dataset.active = pinned.has(group.id) ? 'true' : 'false'
      item.textContent = `${pinned.has(group.id) ? '★ ' : '☆ '}${group.row.textContent?.trim().slice(0, 24) ?? group.id}`
      item.addEventListener('click', (event) => {
        event.stopPropagation()
        if (pinned.has(group.id)) pinned.delete(group.id)
        else pinned.add(group.id)
        persistPinned()
        apply()
        renderPanel(collectGroups(slot))
      })
      panel.appendChild(item)
    }
  }

  const originalOrders = new WeakMap<HTMLElement, string>()
  let frame = 0
  const apply = () => {
    frame = 0
    const groups = collectGroups(slot)
    const archived = options.archivedFilter()
    const collapse = archived === 'default' && !expanded

    for (const group of groups) {
      group.element.setAttribute('data-dsh-simplify-group', group.id)
      group.element.toggleAttribute('data-dsh-simplify-pinned', pinned.has(group.id))
      const count = group.element.querySelectorAll(SESSION_ROW).length
      group.row.setAttribute('data-dsh-simplify-count', String(count))
      group.row.setAttribute('title', `当前列表可见 ${count} 个会话`)
    }

    const workspace = options.workspaces.getSnapshot()
    const activity = workspaceActivity(workspace.items, options.sessions.getSnapshot().byId, workspace.archivedSessionIds, archived)
    const ranked = orderWorkspaceGroups(groups.map(group => ({ ...group, pinned: pinned.has(group.id) })), activity)
    const visible = visibleGroupIds(ranked)
    for (const [index, group] of ranked.entries()) {
      if (!originalOrders.has(group.element)) originalOrders.set(group.element, group.element.style.order)
      group.element.style.order = String(index - ranked.length)
      group.element.toggleAttribute('data-dsh-simplify-collapsed', collapse && !visible.has(group.id))
    }

    const hidden = hiddenCount(ranked)
    toggle.hidden = hidden === 0 && !expanded
    const label = expanded
      ? options.locale('groups.collapse')
      : options.locale('groups.more', { count: hidden })
    if (toggle.textContent !== label) toggle.textContent = label
  }

  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      try {
        apply()
      } catch (error) {
        console.error('[dsh-simplify-theme] sidebar groups failed:', error)
      }
    })
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation()
    expanded = !expanded
    localStorage.setItem(EXPANDED_KEY, expanded ? '1' : '0')
    apply()
  })

  pinButton.addEventListener('click', (event) => {
    event.stopPropagation()
    panel.hidden = !panel.hidden
    if (!panel.hidden) renderPanel(collectGroups(slot))
  })

  const closeOnOutside = (event: Event) => {
    if (panel.hidden) return
    const target = event.target
    if (target instanceof Element && target.closest('[data-dsh-simplify-groups-controls]') !== null) return
    panel.hidden = true
  }
  document.addEventListener('pointerdown', closeOnOutside, true)

  const observer = new MutationObserver(schedule)
  observer.observe(slot, { childList: true, subtree: true })
  const unsubscribeWorkspaces = options.workspaces.subscribe(schedule)
  const unsubscribeSessions = options.sessions.subscribe(schedule)
  schedule()

  return {
    unmount: () => {
      observer.disconnect()
      unsubscribeWorkspaces()
      unsubscribeSessions()
      document.removeEventListener('pointerdown', closeOnOutside, true)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      for (const group of collectGroups(slot)) {
        const order = originalOrders.get(group.element)
        if (order !== undefined) group.element.style.order = order
        group.element.removeAttribute('data-dsh-simplify-group')
        group.element.removeAttribute('data-dsh-simplify-pinned')
        group.element.removeAttribute('data-dsh-simplify-collapsed')
        group.row.removeAttribute('data-dsh-simplify-count')
      }
      controls.remove()
    }
  }
}
