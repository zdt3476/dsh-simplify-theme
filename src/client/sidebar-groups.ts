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
import { loadSimplifyConfig, onSimplifyConfigChange } from './plugin-config'

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
 * 折叠后应保持可见的组：
 * - unpinnedLimit: 未置顶文件夹可见数量上限（默认 5）
 * - pinnedLimit: 置顶文件夹可见数量上限（默认 5；若 <= 0 则全部置顶可见）
 */
export function visibleGroupIds(
  groups: readonly GroupInfo[],
  unpinnedLimit = COLLAPSED_LIMIT,
  pinnedLimit = 5
): Set<string> {
  const visible = new Set<string>()
  let ordinary = 0
  let pinned = 0
  for (const group of groups) {
    if (group.pinned) {
      if (pinnedLimit <= 0 || pinned < pinnedLimit) {
        visible.add(group.id)
        pinned += 1
      }
      continue
    }
    if (ordinary < unpinnedLimit) {
      visible.add(group.id)
      ordinary += 1
    }
  }
  return visible
}

/** 折叠按钮文案：还有多少个组被收起。 */
export function hiddenCount(
  groups: readonly GroupInfo[],
  unpinnedLimit = COLLAPSED_LIMIT,
  pinnedLimit = 5
): number {
  const visible = visibleGroupIds(groups, unpinnedLimit, pinnedLimit)
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

  // 侧栏独立小节分区分组（方案 A：Linear / Slack / Notion 风格）
  const pinnedHeader = options.createElement('div')
  pinnedHeader.className = 'dsh-simplify-sidebar-section is-pinned'
  pinnedHeader.dataset.dshSimplifySection = 'pinned'
  pinnedHeader.hidden = true

  const unpinnedHeader = options.createElement('div')
  unpinnedHeader.className = 'dsh-simplify-sidebar-section is-unpinned'
  unpinnedHeader.dataset.dshSimplifySection = 'unpinned'
  unpinnedHeader.hidden = true

  // 面板挂到 body：侧栏标题行是 overflow:hidden，放在里面会被裁成一条。
  const panel = options.createElement('div')
  panel.dataset.dshSimplifyPinPanel = ''
  panel.hidden = true
  document.body.appendChild(panel)

  const placePanel = () => {
    const rect = pinButton.getBoundingClientRect()
    const width = panel.offsetWidth
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
    panel.style.left = `${Math.round(left)}px`
    panel.style.top = `${Math.round(rect.bottom + 6)}px`
  }

  const openPanel = () => {
    renderPanel(collectGroups(slot))
    panel.hidden = false
    placePanel()
  }

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
        // 选完即收起：置顶是低频操作，面板常驻会挡住列表。
        panel.hidden = true
      })
      panel.appendChild(item)
    }
  }

  const originalOrders = new WeakMap<HTMLElement, string>()
  let frame = 0
  const apply = () => {
    frame = 0
    const groups = collectGroups(slot)
    const config = loadSimplifyConfig()

    if (!config.sidebarGrouping) {
      pinnedHeader.hidden = true
      unpinnedHeader.hidden = true
      for (const group of groups) {
        group.element.removeAttribute('data-dsh-simplify-group')
        group.element.removeAttribute('data-dsh-simplify-pinned')
        group.element.removeAttribute('data-dsh-simplify-collapsed')
        group.element.removeAttribute('data-dsh-simplify-pinned-tail')
        group.row.removeAttribute('data-dsh-simplify-count')
        group.row.removeAttribute('title')
        const prevOrder = originalOrders.get(group.element)
        if (prevOrder !== undefined) group.element.style.order = prevOrder
      }
      controls.hidden = true
      return
    }
    controls.hidden = false

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
    const visible = visibleGroupIds(ranked, config.sidebarUnpinnedLimit, config.sidebarPinnedLimit)

    const listContainer = groups[0]?.element.parentElement ?? null
    if (listContainer !== null) {
      if (pinnedHeader.parentElement !== listContainer) listContainer.appendChild(pinnedHeader)
      if (unpinnedHeader.parentElement !== listContainer) listContainer.appendChild(unpinnedHeader)
    }

    const pinnedGroupIds = new Set(groups.filter(g => pinned.has(g.id)).map(g => g.id))
    const pinnedCount = pinnedGroupIds.size
    const unpinnedCount = ranked.length - pinnedCount

    if (pinnedCount > 0) {
      pinnedHeader.hidden = false
      pinnedHeader.style.order = String(-ranked.length * 2 - 2)
      pinnedHeader.innerHTML = `
        <span class="dsh-simplify-section-title"><span class="dsh-simplify-section-icon" aria-hidden="true">📌</span>${options.locale('groups.pinnedTitle')}</span>
        <span class="dsh-simplify-section-badge">${pinnedCount}</span>
      `

      if (unpinnedCount > 0) {
        unpinnedHeader.hidden = false
        unpinnedHeader.style.order = String((pinnedCount - ranked.length) * 2 - 1)
        unpinnedHeader.innerHTML = `
          <span class="dsh-simplify-section-title">${options.locale('groups.unpinnedTitle')}</span>
          <span class="dsh-simplify-section-badge">${unpinnedCount}</span>
        `
      } else {
        unpinnedHeader.hidden = true
      }
    } else {
      pinnedHeader.hidden = true
      unpinnedHeader.hidden = true
    }

    for (const [index, group] of ranked.entries()) {
      if (!originalOrders.has(group.element)) originalOrders.set(group.element, group.element.style.order)
      group.element.style.order = String((index - ranked.length) * 2)
      group.element.toggleAttribute('data-dsh-simplify-collapsed', collapse && !visible.has(group.id))
      const isPinned = pinnedGroupIds.has(group.id)
      group.element.toggleAttribute('data-dsh-simplify-pinned', isPinned)
    }

    if (pinned.size > 0) pinButton.title = `${options.locale('groups.pinHint')}（已置顶 ${pinned.size} 个）`
    else pinButton.title = options.locale('groups.pinHint')

    const hidden = hiddenCount(ranked, config.sidebarUnpinnedLimit, config.sidebarPinnedLimit)
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
    if (panel.hidden) openPanel()
    else panel.hidden = true
  })

  const closeOnOutside = (event: Event) => {
    if (panel.hidden) return
    const target = event.target
    if (target instanceof Element && (target.closest('[data-dsh-simplify-groups-controls]') !== null || target.closest('[data-dsh-simplify-pin-panel]') !== null)) return
    panel.hidden = true
  }
  const closeOnKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && !panel.hidden) panel.hidden = true
  }
  const closeOnScroll = () => {
    if (!panel.hidden) placePanel()
  }
  document.addEventListener('pointerdown', closeOnOutside, true)
  document.addEventListener('keydown', closeOnKey, true)
  window.addEventListener('scroll', closeOnScroll, true)
  window.addEventListener('resize', closeOnScroll)

  const observer = new MutationObserver(schedule)
  observer.observe(slot, { childList: true, subtree: true })
  const unsubscribeWorkspaces = options.workspaces.subscribe(schedule)
  const unsubscribeSessions = options.sessions.subscribe(schedule)
  const unsubscribeConfig = onSimplifyConfigChange(schedule)
  schedule()

  return {
    unmount: () => {
      observer.disconnect()
      unsubscribeWorkspaces()
      unsubscribeSessions()
      unsubscribeConfig()
      document.removeEventListener('pointerdown', closeOnOutside, true)
      document.removeEventListener('keydown', closeOnKey, true)
      window.removeEventListener('scroll', closeOnScroll, true)
      window.removeEventListener('resize', closeOnScroll)
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
      panel.remove()
      pinnedHeader.remove()
      unpinnedHeader.remove()
    }
  }
}
