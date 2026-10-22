import { describe, expect, it } from 'vitest'
import { SIMPLIFY_TOKENS } from '../../src/client/tokens'

describe('token layer', () => {
  const entries = Object.entries(SIMPLIFY_TOKENS)

  it('只覆盖 --dsw- 命名空间', () => {
    expect(entries.length).toBeGreaterThan(0)
    for (const [token] of entries) expect(token.startsWith('--dsw-')).toBe(true)
  })

  it('每个 token 都给出亮暗两个非空值', () => {
    for (const [token, value] of entries) {
      // 单个裸字符串在切换配色后会不可读，overrideTokens 也会直接抛错。
      expect(typeof value).toBe('object')
      expect(typeof value.light, token).toBe('string')
      expect(typeof value.dark, token).toBe('string')
      expect(value.light.trim(), token).not.toBe('')
      expect(value.dark.trim(), token).not.toBe('')
    }
  })

  it('token 层是冻结的，避免运行时被就地改写', () => {
    expect(Object.isFrozen(SIMPLIFY_TOKENS)).toBe(true)
  })
})
