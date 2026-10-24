/**
 * 新会话（hero）态的 dock 注入。
 *
 * DSH 只在会话态渲染 `conversation.composer.dock` slot；hero 态下该 slot 不存在，
 * 原生 model / permission 控件仍留在输入卡片里。这里在 hero 的 dock 行
 * （`[data-composer-dock]`）里注入我们自己的控件容器，让两种状态的排版一致：
 * 模型贴卡片左缘、权限贴右缘、统计项居中。
 *
 * 注入的容器带 `data-dsh-simplify-dock`，因此 `:has()` 隐藏原生座位的规则在 hero
 * 态同样生效；进入会话态（slot 出现）时自动移除，交还给 slot 渲染。
 *
 * 权限当前值需要会话投影：hero 里拿不到 slot 的标准 hook，改用轮询读取
 * `session.projections.values().permissions.currentValue`（700ms，开销可忽略）。
 */

import type { ReactHooks } from './dock-shared'
import type { ModelDirectories } from './model-directory'
import { createModelControl } from './model-control'
import { createPermissionControl, type PermissionSession } from './permission-control'

export const CURRENT_SESSION_KEY = 'dsh.sessions.current'

/** 从 localStorage 的会话选择记录里取当前会话 id。 */
export function readCurrentSessionId(raw: string | null): string | undefined {
  if (raw === null) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    const id = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>).sessionId : undefined
    return typeof id === 'string' && id !== '' ? id : undefined
  } catch {
    return undefined
  }
}

/** hero 注入条件：存在 dock 行、没有 slot 渲染、也还没有我们的宿主。 */
export function shouldInjectHeroDock(state: { hasRow: boolean; hasSlot: boolean; hasHost: boolean }): boolean {
  return state.hasRow && !state.hasSlot && !state.hasHost
}

export interface PollingSource<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
}

/** 轮询式只读快照源，供 useSyncExternalStore 使用。 */
export function createPollingSource<T>(read: () => T, intervalMs = 700): PollingSource<T> {
  let value = read()
  const listeners = new Set<() => void>()
  let timer: number | undefined
  const tick = () => {
    const next = read()
    if (next === value) return
    value = next
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      if (timer === undefined) timer = window.setInterval(tick, intervalMs)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0 && timer !== undefined) {
          window.clearInterval(timer)
          timer = undefined
        }
      }
    }
  }
}

export interface HeroDockOptions {
  directories: ModelDirectories
  remote: { permissionPresets: { catalog: () => Promise<{ ok: boolean; value?: import('./permission-catalog').PermissionCatalog; error?: { code: string; message: string } }> } }
  sessionOf: (sessionId: string) => PermissionSession | undefined
  permissionValueOf: (sessionId: string) => string | undefined
  usage?: () => import('./usage-rank').UsageRank
  recordSelection?: (provider: string, model: string) => void
  shared: { h: (type: string, props: Record<string, unknown>, ...children: unknown[]) => unknown; hooks: ReactHooks; t: (key: string) => string }
  React: {
    createRoot: (container: HTMLElement) => { render: (node: unknown) => void; unmount: () => void }
  }
}

interface Mounted {
  host: HTMLElement
  root: { render: (node: unknown) => void; unmount: () => void }
  sessionId: string
}

export interface HeroDockHandle {
  dispose: () => void
}

export function mountHeroDock(options: HeroDockOptions): HeroDockHandle | null {
  if (typeof document === 'undefined') return null

  // 每个会话都想拿到稳定的控件实例：按 sessionId 缓存，避免每次渲染重建丢状态。
  const componentCache = new Map<string, () => unknown>()
  const componentFor = (sessionId: string) => {
    const cached = componentCache.get(sessionId)
    if (cached !== undefined) return cached
    const model = createModelControl({ sessionId, directories: options.directories, usage: options.usage, recordSelection: options.recordSelection, shared: { h: options.shared.h as never, hooks: options.shared.hooks, t: options.shared.t as never } })
    const permission = createPermissionControl({
      sessionId,
      remote: options.remote,
      session: () => options.sessionOf(sessionId),
      shared: { h: options.shared.h as never, hooks: options.shared.hooks, t: options.shared.t as never }
    })
    const source = createPollingSource(() => options.permissionValueOf(sessionId))
    const component = () => {
      const permissionValue = options.shared.hooks.useSyncExternalStore(source.subscribe, source.getSnapshot)
      return options.shared.h(
        'div',
        { 'data-dsh-simplify-dock': '' },
        options.shared.h('div', { 'data-dsh-simplify-dock-left': '' }, options.shared.h(model as never, {})),
        options.shared.h('div', { 'data-dsh-simplify-dock-right': '' }, options.shared.h(permission as never, { permissionValue }))
      )
    }
    componentCache.set(sessionId, component)
    return component
  }

  let mounted: Mounted | null = null
  let frame = 0

  const remove = () => {
    if (mounted === null) return
    mounted.root.unmount()
    mounted.host.remove()
    mounted = null
    componentCache.clear()
  }

  const sync = () => {
    const seat = document.querySelector('[data-composer-seat]')
    const row = seat?.querySelector('[data-composer-dock]') as HTMLElement | null
    const hasSlot = row?.querySelector('[data-slot="conversation.composer.dock"]') !== null && row !== null
    const existing = row?.querySelector('[data-dsh-simplify-hero-host]') as HTMLElement | null
    const sessionId = readCurrentSessionId(localStorage.getItem(CURRENT_SESSION_KEY))

    // 进入会话态或找不到会话：撤掉注入，交还 slot / 原生控件。
    if (row === null || hasSlot || sessionId === undefined) {
      remove()
      return
    }
    if (existing !== null && mounted !== null && mounted.sessionId === sessionId && existing === mounted.host && mounted.host.isConnected) return
    remove()
    const host = document.createElement('div')
    host.setAttribute('data-dsh-simplify-hero-host', '')
    row.appendChild(host)
    const root = options.React.createRoot(host)
    root.render(options.shared.h(componentFor(sessionId) as never, {}))
    mounted = { host, root, sessionId }
  }

  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      try {
        sync()
      } catch (error) {
        console.error('[dsh-simplify-theme] hero dock sync failed:', error)
      }
    })
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()

  return {
    dispose: () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
      remove()
    }
  }
}
