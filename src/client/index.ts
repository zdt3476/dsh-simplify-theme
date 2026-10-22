/**
 * 插件 Client 入口。
 *
 * 职责：
 * 1. 注册全局样式（dock 控件 + `:has()` 隐藏原生 seat + tabs）；
 * 2. 注册 `conversation.composer.dock` 条目：模型 + 思考等级 + 权限；
 * 3. 侧栏 DOM 注入归档 tabs（写走 `ctx.uiWorkspace.view`）；
 * 4. `conversation.input.model.label` trigger 位加供应商前缀（hero 态也生效）。
 *
 * React 不进 bundle：require('react') / require('react-dom/client') 由
 * ModuleLoader 壳提供，这正是 tsdown client 构建保持 require 的原因。
 */

import { SIMPLIFY_TOKENS, THEME_SOURCE } from './tokens'
import { UI_CSS } from './styles'
import { mountSidebarTabs } from './sidebar-tabs'
import { mountSidebarFilter } from './sidebar-filter-mount'
import { createDockControl } from './dock-control'
import type { DockShared, H, ReactHooks } from './dock-shared'
import type { ModelDirectories } from './model-directory'
import type { PermissionSession } from './permission-control'

const PLUGIN_ID = 'dsh-simplify-theme'

interface LocaleService {
  register: (ns: string, dicts: Record<string, Record<string, string>>) => () => void
  bind: (ns: string) => (key: string, params?: Record<string, string | number>) => string
}

interface SlotRegistry {
  inject: (name: string, callback: () => unknown) => unknown
  register: (registration: Record<string, unknown>, component: unknown) => unknown
}

interface SessionsService {
  binding: (sessionId: string) => { session?: PermissionSession } | undefined
  scope?: (sessionId: string) => unknown
}

interface ClientCtx {
  slots: SlotRegistry
  locale: LocaleService
  effect: (fn: () => void | (() => void), name?: string) => void
  sessions?: SessionsService
  inject: (services: string[], callback: (scope: Record<string, unknown>) => void) => void
  get?: (name: string) => unknown
  modelDirectories: ModelDirectories
  remote: {
    permissionPresets: {
      catalog: () => Promise<{ ok: boolean; value?: import('./permission-catalog').PermissionCatalog; error?: { code: string; message: string } }>
    }
  }
  theme?: { overrideTokens: (source: string, tokens: unknown) => () => void }
  uiWorkspace?: {
    view: { setArchivedFilter: (filter: 'default' | 'show' | 'only') => void }
  }
}

export const name = PLUGIN_ID
export const inject = ['slots', 'locale', 'modelDirectories', 'remote', 'remote.permissionPresets', 'sessions', 'theme']

const DICT_ZH: Record<string, string> = {
  'tabs.sessions': '会话',
  'tabs.archived': '已归档',
  'model.placeholder': '选择模型',
  'model.empty': '暂无可用模型',
  'provider.account': 'DeepSeek 账号',
  'effort.title': '思考等级',
  'effort.unavailable': '当前模型没有可选的思考等级',
  'permission.readOnly': '仅可查看',
  'permission.workspaceWrite': '工作区内修改',
  'permission.fullAccess': '完全权限',
  'permission.loading': '正在加载权限目录…',
  'permission.confirmTitle': '此模式将减少确认步骤，确认继续？',
  'permission.confirmEnable': '我已了解风险，继续启用',
  'permission.cancel': '取消',
  'error.load': '加载失败',
  'error.session': '会话尚未就绪'
}

const DICT_EN: Record<string, string> = {
  'tabs.sessions': 'Sessions',
  'tabs.archived': 'Archived',
  'model.placeholder': 'Select model',
  'model.empty': 'No models available',
  'provider.account': 'DeepSeek Account',
  'effort.title': 'Reasoning effort',
  'effort.unavailable': 'No reasoning effort levels for this model',
  'permission.readOnly': 'Read Only',
  'permission.workspaceWrite': 'Workspace Write',
  'permission.fullAccess': 'Full access',
  'permission.loading': 'Loading permission catalog…',
  'permission.confirmTitle': 'This mode reduces confirmation steps. Continue?',
  'permission.confirmEnable': 'I understand the risk, continue',
  'permission.cancel': 'Cancel',
  'error.load': 'Load failed',
  'error.session': 'Session is not ready'
}

function installStyles(ctx: ClientCtx): void {
  ctx.effect(() => {
    if (typeof document === 'undefined') return
    const tagId = `${PLUGIN_ID}/ui.css`
    if (document.querySelector(`style[data-plugin-css="${tagId}"]`) !== null) return
    const tag = document.createElement('style')
    tag.dataset.plugin = PLUGIN_ID
    tag.dataset.pluginCss = tagId
    tag.textContent = UI_CSS
    document.head.appendChild(tag)
    return () => tag.remove()
  }, 'simplify-theme: ui styles')
}

function mountSidebarTabsSafe(ctx: ClientCtx): void {
  // uiWorkspace 由 ui-workspace 提供；tabs 只在点击瞬间解析服务，
  // 不需要在 apply 阶段等待——ctx.get 缺服务时抛错会被 step 捕获上报。
  const react = require('react') as unknown as { createElement: unknown }
  const reactDom = require('react-dom/client') as unknown as { createRoot: (c: HTMLElement) => { render: (n: unknown) => void; unmount: () => void } }
  const workspace = () => {
    const service = (ctx as { get?: (name: string) => unknown }).get?.('uiWorkspace') as ClientCtx['uiWorkspace'] | undefined
    if (service === undefined) throw new Error('uiWorkspace service unavailable')
    return service
  }
  ctx.effect(() => {
    const t = ctx.locale.bind(PLUGIN_ID)
    const makeEl = (tag: string) => document.createElement(tag)
    // slot 容器由 ui-workspace 异步渲染；激活期 anchor 常不存在，短重试兜底。
    if (typeof document === 'undefined') return
    let mount: { unmount: () => void } | null = null
    let retries = 0
    const tryMount = () => {
      if (mount !== null) return
      mount = mountSidebarTabs({
        locale: t,
        workspace,
        createElement: makeEl,
        React: {
          createElement: react.createElement,
          createRoot: (container: HTMLElement) => {
            const root = reactDom.createRoot(container)
            return { render: (node: unknown) => root.render(node), unmount: () => root.unmount() }
          },
          hooks: require('react') as unknown as ReactHooks
        }
      })
      if (mount === null && retries < 40) {
        retries += 1
        window.setTimeout(tryMount, 250)
      }
    }
    tryMount()
    return () => {
      mount?.unmount()
      // 重试计划一并取消：置 mount 为已完成态让后续 tryMount 直接返回。
      if (mount === null) {
        mount = { unmount: () => {} }
      }
    }
  }, 'simplify-theme: sidebar tabs')

  ctx.effect(() => {
    const filterT = ctx.locale.bind(PLUGIN_ID)
    if (typeof document === 'undefined') return
    let filterMount: { unmount: () => void } | null = null
    let filterRetries = 0
    const tryFilter = () => {
      if (filterMount !== null) return
      filterMount = mountSidebarFilter({
        locale: filterT,
        createElement: (tag) => document.createElement(tag)
      })
      if (filterMount === null && filterRetries < 40) {
        filterRetries += 1
        window.setTimeout(tryFilter, 250)
      }
    }
    tryFilter()
    return () => {
      filterMount?.unmount()
      if (filterMount === null) filterMount = { unmount: () => {} }
    }
  }, 'simplify-theme: sidebar filter')
}

function registerDock(ctx: ClientCtx): void {
  const react = require('react') as unknown as { createElement: unknown }
  const hooks = require('react') as unknown as ReactHooks
  const h = react.createElement as H
  const t = ctx.locale.bind(PLUGIN_ID)
  const shared: DockShared = { h, hooks, t }

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
    {
      name: 'conversation.composer.dock',
      id: 'simplify-model-permission',
      order: -10,
      inject: (sessionId: string) => ({
        sessionId,
        directories: ctx.modelDirectories,
        remote: { permissionPresets: { catalog: () => ctx.remote.permissionPresets.catalog() } },
        useProjection: (key: 'permissions') => {
          // 会话级 permissions 当前值：session 对象的 projections store。
          const session = ctx.sessions?.binding?.(sessionId)?.session as
            | { projections?: { values?: () => Record<string, { currentValue?: string }> } }
            | undefined
          return session?.projections?.values?.().permissions as { currentValue: string } | undefined
        },
        session: () => ctx.sessions?.binding(sessionId)?.session
      })
    },
    (entryProps: Record<string, unknown>) => {
      const { sessionId, directories, remote, useProjection, session } = entryProps as {
        sessionId: string
        directories: ModelDirectories
        remote: ClientCtx['remote']
        useProjection: (key: 'permissions') => { currentValue: string } | undefined
        session: () => PermissionSession | undefined
      }
      const control = createDockControl({ sessionId, directories, remote, useProjection, session, shared })
      return control()
    }
  ))
}

function registerModelLabelPrefix(ctx: ClientCtx): void {
  const react = require('react') as unknown as { createElement: unknown }
  const labelH = react.createElement as H
  const labelT = ctx.locale.bind(PLUGIN_ID)
  ctx.slots.inject('conversation.input.model.label', () => ctx.slots.register(
    { name: 'conversation.input.model.label', priority: -1 },
    (props: Record<string, unknown>) => {
      const { provider, model, placement } = props as {
        provider: { id: string; name: string }
        model: { name: string }
        placement: 'trigger' | 'menu' | 'option'
      }
      if (placement !== 'trigger') return labelH('span', {}, model.name)
      const prefix = provider.id === 'deepseek-account' ? labelT('provider.account') : provider.name
      return labelH('span', {}, `${prefix} · ${model.name}`)
    }
  ))
}

/** 单步执行并上报失败；一步抛错不拖垮其余功能。 */
function step(label: string, run: () => void): void {
  try {
    run()
  } catch (error) {
    console.error(`[${PLUGIN_ID}] ${label} 注册失败:`, error)
  }
}

export function apply(ctx: ClientCtx): void {
  step('locale', () => ctx.locale.register(PLUGIN_ID, { zh: DICT_ZH, en: DICT_EN }))
  if (ctx.theme !== undefined) {
    step('theme', () => ctx.effect(() => ctx.theme!.overrideTokens(THEME_SOURCE, SIMPLIFY_TOKENS), 'simplify-theme: token layer'))
  }
  step('styles', () => installStyles(ctx))
  step('tabs', () => mountSidebarTabsSafe(ctx))
  step('dock', () => registerDock(ctx))
  step('model-label', () => registerModelLabelPrefix(ctx))
}
