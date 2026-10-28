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
import { mountSidebarGroups } from './sidebar-groups'
import type { ActivityStore, SessionActivitySnapshot, WorkspaceActivitySnapshot } from './sidebar-activity'
import { mountHeroDock } from './hero-dock'
import { mountStatColors } from './stat-colors-mount'
import { mountTurnDuration } from './turn-duration'
import { mountDelegationPanel } from './delegation-panel'
import { mountDockAlign } from './dock-align'
import { collectUsage } from './usage-rank'
import { readLocalUsage, recordLocalUsage } from './usage-store'
import { CURRENT_SESSION_KEY, readCurrentSessionId } from './hero-dock'
import { readArchivedFilter, VIEW_STORE_KEY } from './view-state'
import { withFallback } from './locale-fallback'
import { createDockControl } from './dock-control'
import type { DockShared, H, ReactHooks } from './dock-shared'
import type { ModelDirectories } from './model-directory'
import type { PermissionSession } from './permission-control'

const PLUGIN_ID = 'dsh-simplify-theme'

/** 构建时注入；未注入（本地直接跑源码）时回落到 dev。 */
declare const __DSH_SIMPLIFY_BUILD__: string
const BUILD = typeof __DSH_SIMPLIFY_BUILD__ === 'string' ? __DSH_SIMPLIFY_BUILD__ : 'dev'

interface LocaleService {
  register: (ns: string, dicts: Record<string, Record<string, string>>) => () => void
  bind: (ns: string) => (key: string, params?: Record<string, string | number>) => string
}

interface SlotRegistry {
  inject: (name: string, callback: () => unknown) => unknown
  register: (registration: Record<string, unknown>, component: unknown) => unknown
}

interface SessionsService {
  list: ActivityStore<SessionActivitySnapshot>
  refreshProjections?: (sessionId: string) => Promise<unknown>
  binding: (sessionId: string) => { session?: PermissionSession } | undefined
  scope?: (sessionId: string) => unknown
}

interface ClientCtx {
  slots: SlotRegistry
  locale: LocaleService
  effect: (fn: () => void | (() => void), name?: string) => void
  sessions?: SessionsService
  workspaces?: { list: ActivityStore<WorkspaceActivitySnapshot> }
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
    view: {
      setArchivedFilter: (filter: 'default' | 'show' | 'only') => void
      setGroupBy: (mode: 'workspace' | 'workspace-tree' | 'flat') => void
    }
  }
}

export const name = PLUGIN_ID
export const inject = ['slots', 'locale', 'modelDirectories', 'remote', 'remote.permissionPresets', 'sessions', 'workspaces', 'theme']

const DICT_ZH: Record<string, string> = {
  'tabs.sessions': '未归档',
  'filter.placeholder': '筛选工作区或会话…',
  'filter.ariaLabel': '筛选工作区或会话',
  'filter.groupBy': '列表分组',
  'filter.workspace': '工作区',
  'filter.workspace-tree': '目录树',
  'filter.flat': '全部会话',
  'effort.providerDefault': '默认',
  'effort.unavailableShort': '不可用',
  'tabs.archived': '已归档',
  'groups.more': '还有 {count} 个工作区',
  'groups.collapse': '收起工作区',
  'groups.pin': '置顶',
  'groups.pinHint': '选择要置顶的工作区',
  'model.placeholder': '选择模型',
  'model.title': '选择模型',
  'model.providers': '{count} 个供应商',
  'model.empty': '暂无可用模型',
  'provider.account': 'DeepSeek 账号',
  'effort.title': '思考等级',
  'effort.unavailable': '当前模型没有可选的思考等级',
  'permission.title': '访问模式',
  'permission.hint': '减少确认范围',
  'permission.readOnly': '仅可查看',
  'permission.workspaceWrite': '工作区内修改',
  'permission.fullAccess': '完全权限',
  'permission.auto': '自动审查',
  'permission.experimental': '实验',
  'permission.loading': '正在加载权限目录…',
  'permission.confirmTitle': '此模式将减少确认步骤，确认继续？',
  'permission.confirmEnable': '我已了解风险，继续启用',
  'permission.cancel': '取消',
  'duration.took': '耗时',
  'delegation.title': '子代理',
  'delegation.agent': '主 Agent',
  'delegation.batch': '第 {index} 次委派',
  'delegation.agents': '{count} 个子代理',
  'delegation.expand': '展开这次委派',
  'delegation.collapse': '收起这次委派',
  'delegation.coordinating': '正在协调 {count} 个委派任务',
  'delegation.running': '{count} 个运行中',
  'delegation.finished': '已完成',
  'delegation.state.running': '运行中',
  'delegation.state.done': '已完成',
  'delegation.state.failed': '失败',
  'delegation.state.denied': '已拒绝',
  'delegation.failed': '{count} 个失败',
  'delegation.open': '打开子会话',
  'delegation.stop': '停止这个子代理',
  'delegation.stopLabel': '停止',
  'delegation.steps': '{count} 个步骤',
  'delegation.stepsShort': '{count} 步',
  'duration.ms': '毫秒',
  'duration.s': '秒',
  'duration.m': '分',
  'error.load': '加载失败',
  'error.session': '会话尚未就绪'
}

const DICT_EN: Record<string, string> = {
  'tabs.sessions': 'Unarchived',
  'filter.placeholder': 'Filter workspaces or sessions…',
  'filter.ariaLabel': 'Filter workspaces or sessions',
  'filter.groupBy': 'Group list',
  'filter.workspace': 'Workspaces',
  'filter.workspace-tree': 'Folder tree',
  'filter.flat': 'All sessions',
  'effort.providerDefault': 'Default',
  'effort.unavailableShort': 'Unavailable',
  'tabs.archived': 'Archived',
  'groups.more': '{count} more workspaces',
  'groups.collapse': 'Collapse workspaces',
  'groups.pin': 'Pin',
  'groups.pinHint': 'Pick workspaces to pin',
  'model.placeholder': 'Select model',
  'model.title': 'Select model',
  'model.providers': '{count} providers',
  'model.empty': 'No models available',
  'provider.account': 'DeepSeek Account',
  'effort.title': 'Reasoning effort',
  'effort.unavailable': 'No reasoning effort levels for this model',
  'permission.title': 'Access mode',
  'permission.hint': 'Fewer confirmations',
  'permission.readOnly': 'Read Only',
  'permission.workspaceWrite': 'Workspace Write',
  'permission.fullAccess': 'Full access',
  'permission.auto': 'Auto review',
  'permission.experimental': 'Beta',
  'permission.loading': 'Loading permission catalog…',
  'permission.confirmTitle': 'This mode reduces confirmation steps. Continue?',
  'permission.confirmEnable': 'I understand the risk, continue',
  'permission.cancel': 'Cancel',
  'duration.took': 'took',
  'delegation.title': 'Subagents',
  'delegation.agent': 'Main agent',
  'delegation.batch': 'Delegation {index}',
  'delegation.agents': '{count} subagents',
  'delegation.expand': 'Expand this delegation',
  'delegation.collapse': 'Collapse this delegation',
  'delegation.coordinating': 'Coordinating {count} delegated tasks',
  'delegation.running': '{count} running',
  'delegation.finished': 'Completed',
  'delegation.state.running': 'Running',
  'delegation.state.done': 'Completed',
  'delegation.state.failed': 'Failed',
  'delegation.state.denied': 'Denied',
  'delegation.failed': '{count} failed',
  'delegation.open': 'Open subagent session',
  'delegation.stop': 'Stop this subagent',
  'delegation.stopLabel': 'Stop',
  'delegation.steps': '{count} steps',
  'delegation.stepsShort': '{count} steps',
  'duration.ms': 'ms',
  'duration.s': 's',
  'duration.m': 'm',
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
    const t = withFallback(ctx.locale.bind(PLUGIN_ID), DICT_ZH)
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
    const filterT = withFallback(ctx.locale.bind(PLUGIN_ID), DICT_ZH)
    if (typeof document === 'undefined') return
    let filterMount: { unmount: () => void } | null = null
    let filterRetries = 0
    const tryFilter = () => {
      if (filterMount !== null) return
      filterMount = mountSidebarFilter({
        locale: filterT,
        setGroupBy: mode => workspace().view.setGroupBy(mode),
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

  ctx.effect(() => {
    if (typeof document === 'undefined') return
    const groupsT = withFallback(ctx.locale.bind(PLUGIN_ID), DICT_ZH)
    const workspaces = ctx.workspaces?.list
    const sessions = ctx.sessions?.list
    if (workspaces === undefined || sessions === undefined) throw new Error('sidebar activity stores unavailable')
    let groupsMount: { unmount: () => void } | null = null
    let attempts = 0
    const tryMount = () => {
      if (groupsMount !== null) return
      groupsMount = mountSidebarGroups({
        locale: groupsT,
        workspaces,
        sessions,
        createElement: (tag) => document.createElement(tag),
        archivedFilter: () => readArchivedFilter(localStorage.getItem(VIEW_STORE_KEY))
      })
      if (groupsMount === null && attempts < 40) {
        attempts += 1
        window.setTimeout(tryMount, 250)
      }
    }
    tryMount()
    return () => {
      groupsMount?.unmount()
      if (groupsMount === null) groupsMount = { unmount: () => {} }
    }
  }, 'simplify-theme: sidebar groups')

  ctx.effect(() => {
    if (typeof document === 'undefined') return
    const t = withFallback(ctx.locale.bind(PLUGIN_ID), DICT_ZH)
    const reactModule = require('react') as unknown as { createElement: H }
    const hero = mountHeroDock({
      directories: ctx.modelDirectories,
      remote: ctx.remote,
      usage: () => collectUsage((ctx.sessions?.list.getSnapshot().byId ?? {}) as never, readLocalUsage()),
      recordSelection: recordLocalUsage,
      sessionOf: (sessionId) => ctx.sessions?.binding(sessionId)?.session,
      permissionValueOf: (sessionId) => {
        const session = ctx.sessions?.binding(sessionId)?.session as
          | { projections?: { values?: () => Record<string, { currentValue?: string }> } }
          | undefined
        return session?.projections?.values?.().permissions?.currentValue
      },
      shared: {
        h: reactModule.createElement,
        hooks: require('react') as unknown as ReactHooks,
        t: t as (key: string) => string
      },
      React: {
        createRoot: (container: HTMLElement) => {
          const reactDom = require('react-dom/client') as unknown as { createRoot: (c: HTMLElement) => { render: (n: unknown) => void; unmount: () => void } }
          return reactDom.createRoot(container)
        }
      }
    })
    return () => hero?.dispose()
  }, 'simplify-theme: hero dock')

  ctx.effect(() => {
    const mount = mountStatColors()
    return () => mount?.unmount()
  }, 'simplify-theme: stat colors')

  ctx.effect(() => {
    const mount = mountDockAlign()
    return () => mount?.dispose()
  }, 'simplify-theme: dock align')

  ctx.effect(() => {
    const sessions = ctx.sessions?.list
    if (sessions === undefined) return
    const t = withFallback(ctx.locale.bind(PLUGIN_ID), DICT_ZH)
    const openSession = (sessionId: string) => {
      const service = (ctx as { get?: (name: string) => unknown }).get?.('uiWorkspace') as { openSession?: (id: string) => void } | undefined
      service?.openSession?.(sessionId)
    }
    const panel = mountDelegationPanel({
      sessions: {
        getSnapshot: () => sessions.getSnapshot() as never,
        subscribe: (listener) => sessions.subscribe(listener),
        refreshProjections: (sessionId) => ctx.sessions?.refreshProjections?.(sessionId)
      },
      currentSessionId: () => readCurrentSessionId(localStorage.getItem(CURRENT_SESSION_KEY)),
      locale: t,
      openSession,
      canCancel: (sessionId: string) => {
        const binding = ctx.sessions?.binding(sessionId) as { session?: { cancel?: () => Promise<unknown> } } | undefined
        return typeof binding?.session?.cancel === 'function'
      },
      cancelSession: (sessionId: string) => {
        const binding = ctx.sessions?.binding(sessionId) as { session?: { cancel?: () => Promise<unknown> } } | undefined
        void binding?.session?.cancel?.().catch?.((error: unknown) => console.error('[dsh-simplify-theme] cancel subagent failed:', error))
      }
    })
    const mount = mountTurnDuration({
      sessions,
      currentSessionId: () => readCurrentSessionId(localStorage.getItem(CURRENT_SESSION_KEY)),
      locale: t
    })
    return () => {
      mount?.unmount()
      panel?.dispose()
    }
  }, 'simplify-theme: turn duration')
}

function registerDock(ctx: ClientCtx): void {
  const react = require('react') as unknown as { createElement: unknown }
  const hooks = require('react') as unknown as ReactHooks
  const h = react.createElement as H
  const t = withFallback(ctx.locale.bind(PLUGIN_ID), DICT_ZH)
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
        session: () => ctx.sessions?.binding(sessionId)?.session
      })
    },
    (entryProps: Record<string, unknown>) => {
      const usage = () => collectUsage((ctx.sessions?.list.getSnapshot().byId ?? {}) as never, readLocalUsage())
      const { sessionId, directories, remote, useProjection, session } = entryProps as {
        sessionId: string
        directories: ModelDirectories
        remote: ClientCtx['remote']
        useProjection: (key: string) => unknown
        session: () => PermissionSession | undefined
      }
      const ref = hooks.useRef<{ sessionId: string; control: ReturnType<typeof createDockControl> } | null>(null)
      if (ref.current === null || ref.current.sessionId !== sessionId) {
        ref.current = { sessionId, control: createDockControl({ sessionId, directories, remote, useProjection, session, shared, usage, recordSelection: recordLocalUsage }) }
      }
      return h(ref.current.control as never, {})
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
  // 每次激活打印一次构建标记，并写到 <html> 上：重启后仍看不到新样式时，
  // 先确认运行的是不是最新构建，而不是继续怀疑功能本身。
  console.info(`[${PLUGIN_ID}] 已加载构建 ${BUILD}`)
  if (typeof document !== 'undefined') document.documentElement.dataset.dshSimplifyBuild = BUILD
  step('locale', () => ctx.locale.register(PLUGIN_ID, { zh: DICT_ZH, en: DICT_EN }))
  if (ctx.theme !== undefined) {
    step('theme', () => ctx.effect(() => ctx.theme!.overrideTokens(THEME_SOURCE, SIMPLIFY_TOKENS), 'simplify-theme: token layer'))
  }
  step('styles', () => installStyles(ctx))
  step('tabs', () => mountSidebarTabsSafe(ctx))
  step('dock', () => registerDock(ctx))
}
