/**
 * 沉浸式浮层互斥 + 全局关闭。
 *
 * DSH 的 slot 组件都自带 MenuSurface；我们的 dock 控件是自绘弹层，需要在
 * 打开时压下原生 Activity 扩展、Escape/外点关闭等行为。这个模块不碰 React，
 * 只管理「一次只开一个弹层」的注册表与全局一次性监听。
 */

type PopupOpener = () => void

const openers = new Set<PopupOpener>()
let listening = false

function ensureListeners(): void {
  if (listening) return
  listening = true
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('keydown', onKeyDown, true)
}

function teardownListeners(): void {
  if (openers.size !== 0) return
  listening = false
  document.removeEventListener('pointerdown', onPointerDown, true)
  document.removeEventListener('keydown', onKeyDown, true)
}

function onPointerDown(event: Event): void {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('[data-dsh-simplify-popup]') !== null || target.closest('[data-dsh-simplify-pill]') !== null) return
  for (const close of openers) close()
  teardownListeners()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  for (const close of openers) close()
  teardownListeners()
}

/** 打开一个弹层：先关掉别的，登记自己的关闭函数。 */
export function acquirePopup(close: PopupOpener): void {
  for (const other of openers) other()
  openers.add(close)
  ensureListeners()
}

/** 弹层正常关闭时的注销。 */
export function releasePopup(close: PopupOpener): void {
  openers.delete(close)
  teardownListeners()
}
