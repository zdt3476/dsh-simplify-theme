import { describe, expect, it } from 'vitest'
import { workspaceActivity, orderWorkspaceGroups } from '../../src/client/sidebar-activity'
import { visibleGroupIds, hiddenCount } from '../../src/client/sidebar-groups'

const workspaces = [
  { workspaceId: 'a', createdAt: '2026-01-01T00:00:00Z', sessionIds: ['old', 'new', 'archived'] },
  { workspaceId: 'empty', createdAt: '2026-02-01T00:00:00Z', sessionIds: ['missing'] }
]
const byId = {
  old: { updatedAt: 100 }, new: { updatedAt: 200 }, archived: { updatedAt: 900 }
}

describe('workspace activity', () => {
  it('取当前分页的最新会话时间，不被归档会话干扰', () => {
    expect(workspaceActivity(workspaces, byId, ['archived'], 'default').get('a')).toBe(200)
    expect(workspaceActivity(workspaces, byId, ['archived'], 'only').get('a')).toBe(900)
    expect(workspaceActivity(workspaces, byId, ['archived'], 'show').get('a')).toBe(900)
  })

  it('没有可用会话时采用创建时间，非法时间保持在末尾', () => {
    const activity = workspaceActivity([...workspaces, { workspaceId: 'invalid', createdAt: 'invalid', sessionIds: [] }], byId, [], 'default')
    expect(activity.get('empty')).toBe(Date.parse('2026-02-01T00:00:00Z'))
    expect(activity.get('invalid')).toBe(0)
    expect(workspaceActivity([], {}, [], 'default').size).toBe(0)
  })

  it('先置顶，再按活跃时间降序；相同时间保留原始顺序且不修改输入', () => {
    const groups = [
      { id: 'old', pinned: false }, { id: 'pin', pinned: true },
      { id: 'new', pinned: false }, { id: 'tie', pinned: false }
    ]
    const ordered = orderWorkspaceGroups(groups, new Map([['old', 10], ['pin', 1], ['new', 20], ['tie', 20]]))
    expect(ordered.map(group => group.id)).toEqual(['pin', 'new', 'tie', 'old'])
    expect(groups[0].id).toBe('old')
    expect(orderWorkspaceGroups(groups, new Map()).map(group => group.id)).toEqual(['pin', 'old', 'new', 'tie'])
  })

  it('支持根据 unpinnedLimit 和 pinnedLimit 独立限制折叠可见数量', () => {
    const groups = [
      { id: 'p1', pinned: true },
      { id: 'p2', pinned: true },
      { id: 'p3', pinned: true },
      { id: 'u1', pinned: false },
      { id: 'u2', pinned: false },
      { id: 'u3', pinned: false },
      { id: 'u4', pinned: false }
    ]

    // 默认：最多 5 个置顶，最多 5 个未置顶（全部 7 个均可见）
    expect(visibleGroupIds(groups).size).toBe(7)
    expect(hiddenCount(groups)).toBe(0)

    // 置顶限制为 2，未置顶限制为 2
    const visible = visibleGroupIds(groups, 2, 2)
    expect([...visible]).toEqual(['p1', 'p2', 'u1', 'u2'])
    expect(hiddenCount(groups, 2, 2)).toBe(3) // p3, u3, u4 被折叠

    // 置顶设为 0 时表示不限制置顶，全部 3 个置顶常驻，普通项展示前 1 个
    const unlimitedPinned = visibleGroupIds(groups, 1, 0)
    expect([...unlimitedPinned]).toEqual(['p1', 'p2', 'p3', 'u1'])
    expect(hiddenCount(groups, 1, 0)).toBe(3) // u2, u3, u4 被折叠
  })
})
