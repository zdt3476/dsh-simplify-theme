/**
 * dock 控件的 React 组件（免 JSX 运行时，直接 createElement）。
 *
 * 两个控件共享同一组样式 token 与弹层互斥；组件保持无状态副作用，
 * 数据读写全部通过注入的回调完成，方便单测。
 */

import { effortLabel, displayName, orderGroups, type CatalogGroup, type ModelSelection } from './model-directory'
import { presetLabel, CONFIRM_PRESETS, type PermissionCatalog } from './permission-catalog'

export type H = (type: string, props: Record<string, unknown>, ...children: unknown[]) => unknown

export interface ReactHooks {
  useState: <S>(init: S | (() => S)) => [S, (next: S | ((prev: S) => S)) => void]
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void
  useRef: <T>(init: T) => { current: T }
  useSyncExternalStore: <S>(subscribe: (fn: () => void) => () => void, getSnapshot: () => S) => S
}

export interface LocaleFn {
  (key: string, params?: Record<string, string | number>): string
}

export interface DockShared {
  h: H
  hooks: ReactHooks
  t: LocaleFn
}

const STOP = () => undefined

/** 复用一个外点/Escape 关闭监听；卸载时移除。 */
export function useDismiss(sh: DockShared, onClose: () => void, active: boolean): void {
  sh.hooks.useEffect(() => {
    if (!active) return
    const onPointer = (event: Event) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-dsh-simplify-dock-root]') !== null) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointer, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [active])
}
