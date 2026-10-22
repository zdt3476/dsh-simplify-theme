/**
 * 归档过滤的只读视图状态。
 *
 * ui-workspace 的 view store 把 archivedFilter 持久化在 localStorage 的
 * `dsh.workspace.view.v5` 里，而写入口只有 `uiWorkspace.view.setArchivedFilter`。
 * tabs 因此采用「读 localStorage 同步显示、写走 service」的组合：View options
 * 菜单的改动会在下一次轮询里反映到 tab 高亮，tab 点击经 service 写回。
 */

export type ArchivedFilter = 'default' | 'show' | 'only'

export const VIEW_STORE_KEY = 'dsh.workspace.view.v5'

/** 从 localStorage 原始值解析过滤态；任何异常都回落到 default。 */
export function readArchivedFilter(raw: string | null): ArchivedFilter {
  if (raw === null) return 'default'
  try {
    const parsed: unknown = JSON.parse(raw)
    const value = parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>).archivedFilter : undefined
    return value === 'show' || value === 'only' ? value : 'default'
  } catch {
    return 'default'
  }
}
