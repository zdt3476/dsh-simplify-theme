import { describe, expect, it } from 'vitest'
import { delegationDuration, selectionEffort, selectionModel, toDelegationNode } from '../../src/client/delegation-tree'
import { delegationNodesFor, errorReasonOf, formatDelegationDuration, isDelegationTool, pickSubagentIds } from '../../src/client/delegation-panel'

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

describe('per-delegation matching', () => {
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

  it('一条工具行只产出一张卡，异常态覆盖运行态', () => {
    expect(delegationNodesFor(['a'], null, store, 0).map(node => node.status)).toEqual(['done'])
    expect(delegationNodesFor(['b'], null, store, 0).map(node => node.status)).toEqual(['running'])
    expect(delegationNodesFor(['a'], 'failed', store, 0).map(node => node.status)).toEqual(['failed'])
    expect(delegationNodesFor(['a'], 'denied', store, 0).map(node => node.status)).toEqual(['denied'])
    expect(delegationNodesFor([], null, store, 0)).toEqual([])
    expect(delegationNodesFor(['missing'], null, store, 0)).toEqual([])
  })
})

describe('model selection shapes', () => {
  it('兼容 { next } 投影视图与扁平 { model }', () => {
    expect(selectionModel({ next: { model: 'deepseek-v4.1-flash' } })).toBe('deepseek-v4.1-flash')
    expect(selectionModel({ model: 'plain' })).toBe('plain')
    expect(selectionModel({ next: null })).toBeUndefined()
    expect(selectionModel(undefined)).toBeUndefined()
  })
})

describe('failure reason', () => {
  it('取错误输出里的第一行并截断', () => {
    const row = {
      querySelector: (selector: string) => (selector === '[data-error]' ? { textContent: '\n  超出配额\n第二行' } : null)
    } as unknown as Element
    expect(errorReasonOf(row)).toBe('超出配额')
    const long = {
      querySelector: () => ({ textContent: 'x'.repeat(400) })
    } as unknown as Element
    expect(errorReasonOf(long)?.length).toBe(160)
    expect(errorReasonOf(null)).toBeUndefined()
  })
})

describe('fallback claiming', () => {
  it('孤儿行按顺序认领未被占用的子代理', () => {
    const rows = {
      a: { id: 'a', displayTitle: 'one', origin: 'subagent', parentId: 'p', running: false },
      b: { id: 'b', displayTitle: 'two', origin: 'subagent', parentId: 'p', running: false },
      other: { id: 'other', displayTitle: 'x', origin: 'subagent', parentId: 'q', running: false }
    }
    const claimed = new Set<string>()
    const first = Object.entries(rows).find(([id, row]) => row !== undefined && row.origin === 'subagent' && row.parentId === 'p' && !claimed.has(id))?.[0]
    expect(first).toBe('a')
    claimed.add(first as string)
    const second = Object.entries(rows).find(([id, row]) => row !== undefined && row.origin === 'subagent' && row.parentId === 'p' && !claimed.has(id))?.[0]
    expect(second).toBe('b')
    claimed.add(second as string)
    expect(Object.entries(rows).find(([id, row]) => row !== undefined && row.origin === 'subagent' && row.parentId === 'p' && !claimed.has(id))).toBeUndefined()
  })
})

describe('subagent effort label', () => {
  it('从模型选择投影取思考等级并本地化', () => {
    expect(selectionEffort({ next: { reasoningEffort: 'high' } })).toBe('高')
    expect(selectionEffort({ reasoningEffort: 'low' })).toBe('低')
    expect(selectionEffort({ next: null })).toBeUndefined()
    expect(selectionEffort(undefined)).toBeUndefined()
    expect(selectionEffort({ next: { reasoningEffort: 'custom-level' } })).toBe('custom-level')
  })
})
