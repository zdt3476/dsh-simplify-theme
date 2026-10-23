/**
 * 轻量 popup 定位：以触发钮为锚，向下弹出、右缘优先，出屏翻转。
 * 独立于 DSH 的 MenuSurface，避免依赖内部 API；样式走本插件 token。
 */

export interface AnchorRect {
  left: number
  right: number
  bottom: number
  top: number
}

export interface Placement {
  left: number
  top: number
}

/**
 * 计算弹层位置：默认挂在锚点下方、左缘对齐锚点左缘；若右侧越界则右缘对齐；
 * 若下方放不下则翻转到锚点上方。
 */
export function placePopup(
  rect: AnchorRect,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  align: 'center' | 'left' | 'right' = 'center'
): Placement {
  let left: number
  if (align === 'center') left = (rect.left + rect.right) / 2 - size.width / 2
  else if (align === 'right') left = rect.right - size.width
  else left = rect.left
  if (left + size.width > viewport.width - 8) left = viewport.width - 8 - size.width
  if (left < 8) left = 8
  let top = rect.bottom + 4
  if (top + size.height > viewport.height - 8) top = Math.max(8, rect.top - size.height - 4)
  return { left: Math.round(left), top: Math.round(top) }
}

/** 测量一个已插入 DOM（visibility 隐藏）的弹层尺寸。 */
export function measurePopup(popup: HTMLElement): { width: number; height: number } {
  const previous = popup.style.visibility
  popup.style.visibility = 'hidden'
  popup.style.display = 'block'
  const rect = popup.getBoundingClientRect()
  popup.style.display = ''
  popup.style.visibility = previous
  return { width: rect.width, height: rect.height }
}
