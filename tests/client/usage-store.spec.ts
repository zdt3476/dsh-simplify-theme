import { describe, expect, it } from 'vitest'
import { addUsage, parseUsage } from '../../src/client/usage-store'

describe('local usage store', () => {
  it('解析容错：坏数据、负数、非对象一律当空', () => {
    expect(parseUsage(null)).toEqual({ providers: {}, models: {} })
    expect(parseUsage('not json')).toEqual({ providers: {}, models: {} })
    expect(parseUsage('[]')).toEqual({ providers: {}, models: {} })
    expect(parseUsage(JSON.stringify({ providers: { a: 2, b: -1, c: 'x' }, models: { 'a/m': 1 } })))
      .toEqual({ providers: { a: 2 }, models: { 'a/m': 1 } })
  })

  it('累计选择次数且不修改入参', () => {
    const base = { providers: { a: 1 }, models: { 'a/m': 1 } }
    const next = addUsage(base, 'a', 'm')
    expect(next.providers.a).toBe(2)
    expect(next.models['a/m']).toBe(2)
    expect(base.providers.a).toBe(1)
    expect(addUsage(base, 'b', 'n').providers.b).toBe(1)
  })
})
