/**
 * 让底部控件行与输入卡片等宽。
 *
 * 卡片宽度是「内容列 + 两侧留白」再受可用宽度挤压的结果，纯 CSS 常量在窄窗口下会
 * 错位（例如 1440 宽时卡片 774px、900 宽时 712px）。这里读卡片的实际宽度写进
 * CSS 变量，控件行按这个变量取宽，任何窗口宽度下左右边缘都和卡片对齐。
 */

const CARD = '[data-composer-card]'
const DOCK_ROW = '[data-composer-dock]'
const HOST = '[data-dsh-simplify-dock]'
const VAR = '--dsh-simplify-card-width'

export interface DockAlignHandle {
  dispose: () => void
}

export function mountDockAlign(): DockAlignHandle | null {
  if (typeof document === 'undefined') return null

  let observer: ResizeObserver | null = null
  let observed: HTMLElement | null = null
  let frame = 0

  const sync = () => {
    frame = 0
    const card = document.querySelector<HTMLElement>(CARD)
    if (card === null) return
    const row = card.parentElement?.querySelector<HTMLElement>(DOCK_ROW) ?? document.querySelector<HTMLElement>(DOCK_ROW)
    if (row === null) return
    // 只在真的渲染了我们控件时才接管宽度，插件禁用时宿主恢复原样。
    if (row.querySelector(HOST) === null && row.querySelector('[data-dsh-simplify-hero-host]') === null) {
      row.style.removeProperty(VAR)
      return
    }
    if (observed !== card) {
      observer?.disconnect()
      observed = card
      observer?.observe(card)
    }
    const width = `${Math.round(card.getBoundingClientRect().width)}px`
    if (row.style.getPropertyValue(VAR) !== width) row.style.setProperty(VAR, width)
  }

  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(sync)
  }

  observer = new ResizeObserver(schedule)
  const mutations = new MutationObserver(schedule)
  mutations.observe(document.body, { childList: true, subtree: true })
  schedule()

  return {
    dispose: () => {
      observer?.disconnect()
      mutations.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      for (const row of document.querySelectorAll<HTMLElement>(DOCK_ROW)) row.style.removeProperty(VAR)
    }
  }
}
