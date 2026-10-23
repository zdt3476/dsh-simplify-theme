/**
 * 权限目录的懒加载快照。
 *
 * 与内置 `PermissionCatalogDirectory` 同源：`ctx.remote.permissionPresets.catalog()`
 * 取全量目录，`connection.generation` 变化失效。这里不重复订阅通知事件，
 * 只在弹层打开时强制重读；`invalidations` 用于关闭已展示的旧选项。
 */

export interface PermissionOption {
  value: string
  name: string
  description?: string
}

export interface PermissionCatalog {
  options: PermissionOption[]
}

/** 需要二次确认的实验/高危预设。 */
export const CONFIRM_PRESETS = new Set(['danger-full-access', 'auto'])

export interface PermissionRemote {
  permissionPresets: {
    catalog: () => Promise<{ ok: boolean; value?: PermissionCatalog; error?: { code: string; message: string } }>
  }
}

export interface PermissionCatalogStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => { value: PermissionCatalog | null }
}

/** 内置预设的本地化键，顺序即风险等级。 */
const PRESET_KEYS: Record<string, string> = {
  'read-only': 'permission.readOnly',
  'workspace-write': 'permission.workspaceWrite',
  'danger-full-access': 'permission.fullAccess',
  auto: 'permission.auto'
}

/** 风险等级：权限控件按它着色（只读=安全、工作区=常规、完全权限=危险、自动审查=实验）。 */
export type PermissionRisk = 'safe' | 'normal' | 'danger' | 'experimental'

export function permissionRisk(value: string): PermissionRisk {
  if (value === 'read-only') return 'safe'
  if (value === 'danger-full-access') return 'danger'
  if (value === 'auto') return 'experimental'
  return 'normal'
}

/** 选中预设的展示名；内置四个值走本地化，其它透传 host 名。 */
export function presetLabel(value: string, name: string, labels: Record<string, string>): string {
  const key = PRESET_KEYS[value]
  if (key !== undefined && (name === value || name === key || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name))) return labels[key] ?? name
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    return name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
  return name
}
