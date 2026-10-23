import type { ArchivedFilter } from './view-state'

export interface ActivityStore<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
}

interface WorkspaceActivityItem {
  workspaceId: string
  createdAt: string
  sessionIds: readonly string[]
}

export interface WorkspaceActivitySnapshot {
  items: readonly WorkspaceActivityItem[]
  archivedSessionIds: readonly string[]
}

export interface SessionActivitySnapshot {
  byId: Record<string, { updatedAt: number } | undefined>
}

export function workspaceActivity(
  workspaces: readonly WorkspaceActivityItem[],
  byId: SessionActivitySnapshot['byId'],
  archivedIds: readonly string[],
  filter: ArchivedFilter
): Map<string, number> {
  const archived = new Set(archivedIds)
  return new Map(workspaces.map(workspace => {
    let latest: number | undefined
    for (const id of workspace.sessionIds) {
      if (filter === 'default' && archived.has(id)) continue
      if (filter === 'only' && !archived.has(id)) continue
      const updatedAt = byId[id]?.updatedAt
      if (updatedAt !== undefined && Number.isFinite(updatedAt)) {
        latest = latest === undefined ? updatedAt : Math.max(latest, updatedAt)
      }
    }
    const created = Date.parse(workspace.createdAt)
    return [workspace.workspaceId, latest ?? (Number.isFinite(created) ? created : 0)]
  }))
}

export function orderWorkspaceGroups<T extends { id: string; pinned: boolean }>(
  groups: readonly T[], activity: ReadonlyMap<string, number>
): T[] {
  return [...groups].sort((a, b) => Number(b.pinned) - Number(a.pinned)
    || (activity.get(b.id) ?? 0) - (activity.get(a.id) ?? 0))
}
