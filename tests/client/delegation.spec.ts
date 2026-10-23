import { describe, expect, it } from 'vitest'
import { delegationDuration, toDelegationNode } from '../../src/client/delegation-tree'
import { formatDelegationDuration, isDelegationTool, pickSubagentIds, turnDelegations } from '../../src/client/delegation-panel'

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

describe('delegation node extraction', () => {
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
    }
  }

  it('取标题、模型、步骤与耗时', () => {
    expect(toDelegationNode('child1', rows.child1, 0)).toEqual({
      id: 'child1',
      title: 'explorer',
      model: 'deepseek-v4.1-flash',
      status: 'done',
      durationMs: 146_000,
      steps: 91
    })
  })

  it('运行中按当前时间累计，非子代理行返回 null', () => {
    const running = { id: 'c', origin: 'subagent', running: true, projectionValues: { subagentTiming: { settledMs: 30_000, active: { since: 1_000 } } } }
    expect(toDelegationNode('c', running, 61_000)).toMatchObject({ status: 'running', durationMs: 90_000 })
    expect(toDelegationNode('o', { id: 'o', origin: 'user' }, 0)).toBeNull()
    expect(toDelegationNode('x', undefined, 0)).toBeNull()
  })

  it('缺少计时或统计时不编造字段', () => {
    expect(toDelegationNode('x', { id: 'x', origin: 'subagent' }, 0)).toEqual({ id: 'x', title: 'x', status: 'done' })
    expect(delegationDuration(undefined, 0)).toBeUndefined()
    expect(delegationDuration({ settledMs: 0 }, 0)).toBeUndefined()
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

describe('per-turn delegation matching', () => {
  const childA = { id: 'a', displayTitle: 'explorer', origin: 'subagent', parentId: 'p', running: false, projectionValues: { subagentTiming: { settledMs: 10_000 } } }
  const childB = { id: 'b', displayTitle: 'explorer', origin: 'subagent', parentId: 'p', running: true, projectionValues: { subagentTiming: { settledMs: 0 } } }
  const store = { a: childA, b: childB }

  it('识别委派工具名', () => {
    expect(isDelegationTool('subagent')).toBe(true)
    expect(isDelegationTool('subagent_fork')).toBe(true)
    expect(isDelegationTool('bash')).toBe(false)
    expect(isDelegationTool(null)).toBe(false)
  })

  it('只认属于本会话子代理的 id', () => {
    const text = 'started subagent 11111111-1111-1111-1111-111111111111'
    expect(pickSubagentIds(text, { '11111111-1111-1111-1111-111111111111': { origin: 'subagent', parentId: 'p' } }, 'p')).toEqual(['11111111-1111-1111-1111-111111111111'])
    expect(pickSubagentIds(text, { '11111111-1111-1111-1111-111111111111': { origin: 'subagent', parentId: 'other' } }, 'p')).toEqual([])
    expect(pickSubagentIds('没有 id', store, 'p')).toEqual([])
  })

  it('按回合归纳节点，失败行标记为失败', () => {
    const turn = turnDelegations([['a'], ['b']], [true, false], store, 'p', 0)
    expect(turn.nodes.map(node => [node.id, node.status])).toEqual([['a', 'failed'], ['b', 'running']])
    expect(turn.failed).toBe(1)
  })

  it('工具行没有 id 时补上未认领的子代理', () => {
    const turn = turnDelegations([[], []], [false, false], store, 'p', 0)
    expect(turn.nodes.map(node => node.id).sort()).toEqual(['a', 'b'])
    expect(turn.failed).toBe(0)
  })
})

describe('cross-turn claiming', () => {
  const madeish = (id: string) => ({ id, origin: 'subagent', parentId: 'p', running: false, projectionValues: { sessionStats: { steps: 1 }, subagentTiming: { settledMs: 1000 } } })
  const store = { a: madeish('a'), b: madeish('b') }

  it('同一子代理只归到最先认领它的回合', () => {
    const claimed = new Set<string>()
    const first = turnDelegations([['a'], ['b']], [false, false], store, 'p', 0, claimed)
    expect(first.nodes.map(node => node.id)).toEqual(['a', 'b'])
    const again = turnDelegations([['a'], ['b']], [false, false], store, 'p', 0, claimed)
    expect(again.nodes).toEqual([])
  })

  it('有 id 的回合不再触发兜底补齐', () => {
    const claimed = new Set<string>()
    const turn = turnDelegations([['a'], []], [false, false], store, 'p', 0, claimed)
    expect(turn.nodes.map(node => node.id)).toEqual(['a'])
  })
})
