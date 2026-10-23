/**
 * 筛选框的 DOM 装配：注入输入框、应用过滤、观察列表重渲染。
 *
 * header 通过「搜索按钮的最近公共容器」定位（aria-label 稳定，class 是哈希）；
 * 列表变化用 childList MutationObserver 驱动重放，样式切换不触发观察。
 */

import { computeHiddenRows, readRow } from './sidebar-filter'
import { sidebarHeader } from './sidebar-dom'

const SLOT_SELECTOR = '[data-slot="sidebar.workspaces"]'

function listRows(slot: Element): Element[] {
  return [...slot.querySelectorAll('[data-row-key]')]
}

export interface SidebarFilterOptions {
  locale: (key: string) => string
  createElement: (tag: string) => HTMLElement
  setGroupBy: (mode: 'workspace' | 'workspace-tree' | 'flat') => void
}

export interface SidebarFilterMount {
  unmount: () => void
}

export function mountSidebarFilter(options: SidebarFilterOptions): SidebarFilterMount | null {
  const slot = document.querySelector(SLOT_SELECTOR)
  const header = slot === null ? null : sidebarHeader(slot)
  if (slot === null || header === null) return null

  header.setAttribute('data-dsh-simplify-sidebar-header', '')
  const host = options.createElement('div')
  host.dataset.dshSimplifyFilterHost = ''
  const tabs = header.parentElement?.querySelector('[data-dsh-simplify-tabs-host]')
  ;(tabs ?? header).insertAdjacentElement('afterend', host)

  const input = options.createElement('input') as HTMLInputElement
  input.type = 'text'
  input.dataset.dshSimplifyFilter = ''
  input.placeholder = options.locale('filter.placeholder')
  input.setAttribute('aria-label', options.locale('filter.ariaLabel'))
  host.appendChild(input)

  const nativeSearch = header.querySelector('input')?.parentElement?.parentElement
  const nativeOptions = header.querySelector<HTMLElement>('button[aria-label="视图选项"], button[aria-label="View options"]')
  nativeSearch?.setAttribute('data-dsh-simplify-native-filter', '')
  nativeOptions?.setAttribute('data-dsh-simplify-native-filter', '')

  const grouping = options.createElement('select') as HTMLSelectElement
  grouping.dataset.dshSimplifyGrouping = ''
  grouping.setAttribute('aria-label', options.locale('filter.groupBy'))
  for (const value of ['workspace', 'workspace-tree', 'flat'] as const) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = options.locale(`filter.${value}`)
    grouping.appendChild(option)
  }
  const saved = localStorage.getItem('dsh.workspace.view.v5')
  if (saved !== null) {
    try {
      const value = JSON.parse(saved) as { groupBy?: string }
      if (value.groupBy !== undefined) grouping.value = value.groupBy
    } catch { /* 损坏的持久化数据由 DSH 使用默认工作区分组。 */ }
  }
  grouping.addEventListener('change', () => options.setGroupBy(grouping.value as 'workspace' | 'workspace-tree' | 'flat'))
  host.appendChild(grouping)

  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { input.value = ''; schedule(); input.blur() }
  })

  let frame = 0
  const apply = () => {
    frame = 0
    slot.toggleAttribute('data-dsh-simplify-filtering', input.value.trim() !== '')
    const hidden = computeHiddenRows(listRows(slot as Element).map(readRow), input.value)
    for (const row of listRows(slot as Element)) {
      const key = row.getAttribute('data-row-key') ?? ''
      const hide = hidden.has(key)
      const next = hide ? 'none' : ''
      if (row.getAttribute('data-dsh-simplify-hidden') !== String(hide)) {
        row.setAttribute('data-dsh-simplify-hidden', String(hide))
        ;(row as HTMLElement).style.display = next
      }
    }
  }
  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(apply)
  }

  input.addEventListener('input', schedule)

  const observer = new MutationObserver(schedule)
  observer.observe(slot, { childList: true, subtree: true })

  return {
    unmount: () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      // 卸载时还原所有被隐藏的行。
      for (const row of listRows(slot as Element)) {
        row.removeAttribute('data-dsh-simplify-hidden')
        ;(row as HTMLElement).style.display = ''
      }
      slot.removeAttribute('data-dsh-simplify-filtering')
      header.removeAttribute('data-dsh-simplify-sidebar-header')
      nativeSearch?.removeAttribute('data-dsh-simplify-native-filter')
      nativeOptions?.removeAttribute('data-dsh-simplify-native-filter')
      host.remove()
    }
  }
}
