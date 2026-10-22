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

/** 选中预设的展示名；内置四个值走本地化，其它透传 host 名。 */
export function presetLabel(value: string, name: string, labels: Record<string, string>): string {
  const keys: Record<string, string> = {
    'read-only': 'permission.readOnly',
    'workspace-write': 'permission.workspaceWrite',
    'danger-full-access': 'permission.fullAccess'
  }
  const key = keys[value]
  if (key !== undefined && (name === value || name === key)) return labels[key] ?? name
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    return name.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }
  return name
}
