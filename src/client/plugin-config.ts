/**
 * 极简主题与增强插件的可视化配置数据模型。
 *
 * 用户可在插件管理页面中直接切换各项功能的启用/禁用，
 * 配置即时生效并持久化保存在 localStorage 中，无需修改配置文件或重启应用。
 */

export interface SimplifyConfig {
  /** 底部栏是否展示平铺统计指标（轮步、容量、TPS、缓存率、单轮耗时） */
  dockStats: boolean
  /** 上下文容量高占用时是否变色警戒（绿色舒适、橙色提醒、红色告急） */
  contextColorAlert: boolean
  /** 是否启用子代理协同派发图卡片 */
  delegationPanel: boolean
  /** 子代理派发图默认是否展开（默认 false 折叠，仅显示精简摘要） */
  delegationExpandedDefault: boolean
  /** 侧栏是否启用未归档/归档分页与实时筛选框 */
  sidebarTabs: boolean
  /** 侧栏是否启用工作区分组与折叠控制 */
  sidebarGrouping: boolean
  /** 侧栏置顶文件夹默认可见数量上限（默认 5） */
  sidebarPinnedLimit: number
  /** 侧栏未置顶文件夹默认可见数量上限（默认 5） */
  sidebarUnpinnedLimit: number
  /** 输入框左下方是否启用模型与思考等级控件 */
  modelControl: boolean
  /** 输入框右下方是否启用权限预设切换控件 */
  permissionControl: boolean
  /** 是否在每轮回答尾部展示该轮总耗时徽标 */
  turnDuration: boolean
  /** 是否应用极简主题 Token 覆盖（去投影、去毛玻璃、收紧圆角） */
  themeOverrides: boolean
}

export const DEFAULT_SIMPLIFY_CONFIG: Readonly<SimplifyConfig> = Object.freeze({
  dockStats: true,
  contextColorAlert: true,
  delegationPanel: true,
  delegationExpandedDefault: false,
  sidebarTabs: true,
  sidebarGrouping: true,
  sidebarPinnedLimit: 5,
  sidebarUnpinnedLimit: 5,
  modelControl: true,
  permissionControl: true,
  turnDuration: true,
  themeOverrides: true
})

export const CONFIG_STORAGE_KEY = 'dsh.simplify-theme.config'
export const CONFIG_CHANGE_EVENT = 'dsh-simplify-theme:config-change'

function parseLimit(val: unknown, fallback: number): number {
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
    return Math.min(100, Math.round(val))
  }
  return fallback
}

/** 从 localStorage 读取当前配置，缺省项回退到默认值 */
export function loadSimplifyConfig(): SimplifyConfig {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SIMPLIFY_CONFIG }
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SIMPLIFY_CONFIG }
    const parsed = JSON.parse(raw) as Partial<SimplifyConfig>
    return {
      dockStats: typeof parsed.dockStats === 'boolean' ? parsed.dockStats : DEFAULT_SIMPLIFY_CONFIG.dockStats,
      contextColorAlert: typeof parsed.contextColorAlert === 'boolean' ? parsed.contextColorAlert : DEFAULT_SIMPLIFY_CONFIG.contextColorAlert,
      delegationPanel: typeof parsed.delegationPanel === 'boolean' ? parsed.delegationPanel : DEFAULT_SIMPLIFY_CONFIG.delegationPanel,
      delegationExpandedDefault: typeof parsed.delegationExpandedDefault === 'boolean' ? parsed.delegationExpandedDefault : DEFAULT_SIMPLIFY_CONFIG.delegationExpandedDefault,
      sidebarTabs: typeof parsed.sidebarTabs === 'boolean' ? parsed.sidebarTabs : DEFAULT_SIMPLIFY_CONFIG.sidebarTabs,
      sidebarGrouping: typeof parsed.sidebarGrouping === 'boolean' ? parsed.sidebarGrouping : DEFAULT_SIMPLIFY_CONFIG.sidebarGrouping,
      sidebarPinnedLimit: parseLimit(parsed.sidebarPinnedLimit, DEFAULT_SIMPLIFY_CONFIG.sidebarPinnedLimit),
      sidebarUnpinnedLimit: parseLimit(parsed.sidebarUnpinnedLimit, DEFAULT_SIMPLIFY_CONFIG.sidebarUnpinnedLimit),
      modelControl: typeof parsed.modelControl === 'boolean' ? parsed.modelControl : DEFAULT_SIMPLIFY_CONFIG.modelControl,
      permissionControl: typeof parsed.permissionControl === 'boolean' ? parsed.permissionControl : DEFAULT_SIMPLIFY_CONFIG.permissionControl,
      turnDuration: typeof parsed.turnDuration === 'boolean' ? parsed.turnDuration : DEFAULT_SIMPLIFY_CONFIG.turnDuration,
      themeOverrides: typeof parsed.themeOverrides === 'boolean' ? parsed.themeOverrides : DEFAULT_SIMPLIFY_CONFIG.themeOverrides
    }
  } catch {
    return { ...DEFAULT_SIMPLIFY_CONFIG }
  }
}

/** 保存部分或全部配置更新，并向全局广播变更事件 */
export function saveSimplifyConfig(patch: Partial<SimplifyConfig>): SimplifyConfig {
  const current = loadSimplifyConfig()
  const next: SimplifyConfig = { ...current, ...patch }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(next))
    } catch (e) {
      console.warn('[dsh-simplify-theme] 无法保存配置到 localStorage:', e)
    }
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: next }))
  }
  return next
}

/** 重置所有配置项为默认值 */
export function resetSimplifyConfig(): SimplifyConfig {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY)
    } catch {}
  }
  const next = { ...DEFAULT_SIMPLIFY_CONFIG }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONFIG_CHANGE_EVENT, { detail: next }))
  }
  return next
}

/** 监听配置变更事件，返回取消订阅函数 */
export function onSimplifyConfigChange(listener: (config: SimplifyConfig) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (event: Event) => {
    const custom = event as CustomEvent<SimplifyConfig>
    listener(custom.detail ?? loadSimplifyConfig())
  }
  window.addEventListener(CONFIG_CHANGE_EVENT, handler)
  return () => window.removeEventListener(CONFIG_CHANGE_EVENT, handler)
}

/** React Hook：在组件中响应式读写当前插件配置 */
export function useSimplifyConfig(hooks: {
  useState: <T>(init: T | (() => T)) => [T, (next: T | ((prev: T) => T)) => void]
  useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void
}): [SimplifyConfig, (patch: Partial<SimplifyConfig>) => void] {
  const [config, setConfig] = hooks.useState<SimplifyConfig>(() => loadSimplifyConfig())
  hooks.useEffect(() => {
    return onSimplifyConfigChange((next) => {
      setConfig(next)
    })
  }, [])
  return [config, saveSimplifyConfig]
}
