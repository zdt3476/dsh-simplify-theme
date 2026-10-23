import { describe, expect, it } from 'vitest'
import { collectDelegations, delegationDuration, summarizeDelegations, toDelegationNode } from '../../src/client/delegation-tree'
import { formatDelegationDuration } from '../../src/client/delegation-panel'

const rows = {
  child1: {
    id: 'child1',
    displayTitle: 'explorer',
    origin: 'subagent',
    parentId: 'parent',
    running: false,
    projectionValues: {
      modelSelection: { provider: 'deepseek', model: 'deepseek-v4.1-flash' },
      sessionStats: { steps: 91 },
      subagentTiming: { settledMs: 146_000 }
    }
  },
  child2: {
    id: 'child2',
    origin: 'subagent',
    parentId: 'parent',
    running: true,
    projectionValues: { subagentTiming: { settledMs: 30_000, active: { since: 1_000 } } }
  },
  other: { id: 'other', origin: 'user', parentId: 'parent' },
  grandchild: { id: 'grandchild', origin: 'subagent', parentId: 'child1' }
}

describe('delegation tree', () => {
  it('只收父会话直接委派的子代理，不回放别人的子代理', () => {
    const nodes = collectDelegations(rows, 'parent', 61_000)
    expect(nodes.map(node => node.id).sort()).toEqual(['child1', 'child2'])
    expect(collectDelegations(rows, undefined)).toEqual([])
  })

  it('取标题、模型、步骤与耗时；运行中按当前时间累计', () => {
    const [first, second] = collectDelegations(rows, 'parent', 61_000)
    expect(first).toMatchObject({ title: 'explorer', model: 'deepseek-v4.1-flash', status: 'done', durationMs: 146_000, steps: 91 })
    expect(second).toMatchObject({ status: 'running', durationMs: 90_000 })
  })

  it('缺少计时或统计时不编造字段', () => {
    expect(toDelegationNode('x', { id: 'x', origin: 'subagent' }, 0)).toEqual({ id: 'x', title: 'x', status: 'done' })
    expect(delegationDuration(undefined, 0)).toBeUndefined()
    expect(delegationDuration({ settledMs: 0 }, 0)).toBeUndefined()
  })

  it('汇总运行中数量与总耗时', () => {
    const summary = summarizeDelegations(collectDelegations(rows, 'parent', 61_000))
    expect(summary).toEqual({ total: 2, finished: 1, running: 1, durationMs: 236_000 })
  })
})

describe('delegation duration formatting', () => {
  const locale = (key: string) => ({ 'duration.s': '秒', 'duration.m': '分' }[key] ?? key)

  it('秒与分之间切换', () => {
    expect(formatDelegationDuration(12_300, locale)).toBe('12.3秒')
    expect(formatDelegationDuration(146_000, locale)).toBe('2分 26秒')
    expect(formatDelegationDuration(120_000, locale)).toBe('2分')
  })
})
