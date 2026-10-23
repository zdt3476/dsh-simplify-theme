/**
 * 百分比统计的上色挂载。
 *
 * 原生统计项是宿主组件，不能改它的渲染，只能在 DOM 上标注语义桶：
 *   - `[data-composer-stat="usage"]` 的标签文本含「缓存命中 N%」；
 *   - 上下文环的触发器文本就是 `N%`，旁边带一个环形 svg。
 * 标注结果交给样式表上色；观察 composer 区域的重渲染，保持同步。
 */

import { classifyPercent, readPercent } from './stat-colors'

const DOCK = '[data-composer-seat]'
const MARK = 'data-dsh-simplify-pct'

interface Target {
  element: HTMLElement
  kind: 'cache' | 'context'
}

function labelOf(element: Element): string {
  return (element.textContent ?? '').trim()
}

/** 收集需要着色的百分比节点；只认缓存命中标签和纯 `N%` 的上下文触发器。 */
function collectTargets(root: ParentNode): Target[] {
  const targets: Target[] = []
  const usage = root.querySelectorAll<HTMLElement>('[data-composer-stat="usage"] *')
  for (const element of usage) {
    if (element.children.length !== 0) continue
    const text = labelOf(element)
    if (!text.includes('%')) continue
    targets.push({ element, kind: 'cache' })
  }
  for (const element of root.querySelectorAll<HTMLElement>(`${DOCK} button`)) {
    if (!/^\d+(?:\.\d+)?%$/.test(labelOf(element))) continue
    if (element.querySelector('svg') === null) continue
    targets.push({ element, kind: 'context' })
  }
  return targets
}

export interface StatColorsMount {
  unmount: () => void
}

export function mountStatColors(): StatColorsMount | null {
  if (typeof document === 'undefined') return null

  const painted = new Set<HTMLElement>()

  const apply = () => {
    const targets = collectTargets(document)
    const live = new Set<HTMLElement>()
    for (const { element, kind } of targets) {
      const percent = readPercent(labelOf(element))
      if (percent === null) continue
      live.add(element)
      const bucket = classifyPercent(kind, percent)
      if (element.getAttribute(MARK) !== bucket) element.setAttribute(MARK, bucket)
      element.setAttribute(`${MARK}-kind`, kind)
    }
    // 数值回落或节点被替换时清掉过期标注，避免颜色残留。
    for (const element of painted) {
      if (live.has(element)) continue
      element.removeAttribute(MARK)
      element.removeAttribute(`${MARK}-kind`)
    }
    painted.clear()
    for (const element of live) painted.add(element)
  }

  let frame = 0
  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      try {
        apply()
      } catch (error) {
        console.error('[dsh-simplify-theme] stat colors failed:', error)
      }
    })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  schedule()

  return {
    unmount: () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      for (const element of painted) {
        element.removeAttribute(MARK)
        element.removeAttribute(`${MARK}-kind`)
      }
      painted.clear()
    }
  }
}
