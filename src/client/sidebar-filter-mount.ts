/**
 * 筛选框的 DOM 装配：注入输入框、应用过滤、观察列表重渲染。
 *
 * header 通过「搜索按钮的最近公共容器」定位（aria-label 稳定，class 是哈希）；
 * 列表变化用 childList MutationObserver 驱动重放，样式切换不触发观察。
 */

import { computeHiddenRows, readRow } from './sidebar-filter'

const SLOT_SELECTOR = '[data-slot="sidebar.workspaces"]'

function findHeader(slot: Element): Element | null {
  const searchButton = slot.querySelector('button[aria-label*="搜索"], button[aria-label*="Search"]')
  return searchButton?.parentElement?.parentElement?.parentElement ?? null
}

function listRows(slot: Element): Element[] {
  return [...slot.querySelectorAll('[data-row-key]')]
}

export interface SidebarFilterOptions {
  locale: (key: string) => string
  createElement: (tag: string) => HTMLElement
}

export interface SidebarFilterMount {
  unmount: () => void
}

export function mountSidebarFilter(options: SidebarFilterOptions): SidebarFilterMount | null {
  const slot = document.querySelector(SLOT_SELECTOR)
  const header = slot === null ? null : findHeader(slot)
  if (slot === null || header === null) return null

  const host = options.createElement('div')
  host.dataset.dshSimplifyFilterHost = ''
  header.insertAdjacentElement('afterend', host)

  const input = options.createElement('input') as HTMLInputElement
  input.type = 'text'
  input.dataset.dshSimplifyFilter = ''
  input.placeholder = options.locale('filter.placeholder')
  input.setAttribute('aria-label', options.locale('filter.ariaLabel'))
  host.appendChild(input)

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
      host.remove()
    }
  }
}
