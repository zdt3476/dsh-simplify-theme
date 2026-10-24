import { describe, expect, it } from 'vitest'
import { collectUsage, rankCatalog } from '../../src/client/usage-rank'

describe('usage ranking', () => {
  it('按会话数聚合供应商与模型，空会话不计', () => {
    const rows = {
      a: { projectionValues: { modelSelection: { next: { provider: 'openai', model: 'gpt-5' } } } },
      b: { projectionValues: { modelSelection: { next: { provider: 'openai', model: 'gpt-5' } } } },
      c: { projectionValues: { modelSelection: { provider: 'deepseek', model: 'flash' } } },
      d: { projectionValues: {} }
    }
    const rank = collectUsage(rows)
    expect(rank.models.get('openai/gpt-5')).toBe(2)
    expect(rank.models.get('deepseek/flash')).toBe(1)
    expect(rank.providers.get('openai')).toBe(2)
    expect(rank.providers.get('deepseek')).toBe(1)
  })

  it('本地记录叠加在会话计数之上', () => {
    const rows = {
      a: { projectionValues: { modelSelection: { next: { provider: 'openai', model: 'gpt-5' } } } }
    }
    const local = { providers: { openai: 3, deepseek: 5 }, models: { 'deepseek/flash': 5 } }
    const rank = collectUsage(rows, local)
    expect(rank.providers.get('openai')).toBe(4)
    expect(rank.providers.get('deepseek')).toBe(5)
    expect(rank.models.get('deepseek/flash')).toBe(5)
    expect(rank.models.get('openai/gpt-5')).toBe(1)
  })

  it('有用的排前面，没用的保持原序', () => {
    const groups = [
      { id: 'a', name: 'A', models: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }] },
      { id: 'b', name: 'B', models: [{ id: 'z', name: 'Z' }] },
      { id: 'c', name: 'C', models: [{ id: 'w', name: 'W' }] }
    ]
    const rank = { providers: new Map([['c', 100]]), models: new Map([['a/y', 60], ['a/x', 20], ['c/w', 100]]) }
    const ranked = rankCatalog(groups, rank)
    expect(ranked.map(group => group.id)).toEqual(['c', 'a', 'b'])
    expect(ranked[1].models.map(model => model.id)).toEqual(['y', 'x'])
  })
})
