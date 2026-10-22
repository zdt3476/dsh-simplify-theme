import { describe, expect, it, vi } from 'vitest'
import { apply, inject, name } from '../../src/client/index'
import { SIMPLIFY_TOKENS, THEME_SOURCE } from '../../src/client/tokens'

describe('client entry', () => {
  it('声明主题插件身份并依赖 theme 服务', () => {
    expect(name).toBe('dsh-simplify-theme')
    expect(inject).toContain('theme')
  })

  it('激活时注册唯一的 token 层，并把 disposer 交给 effect 管理', () => {
    const disposeLayer = vi.fn()
    const overrideTokens = vi.fn(() => disposeLayer)
    const cleanups: Array<() => void> = []
    const ctx = {
      theme: { overrideTokens },
      effect: (fn: () => void | (() => void)) => {
        const cleanup = fn()
        if (typeof cleanup === 'function') cleanups.push(cleanup)
      },
    }

    apply(ctx)

    expect(overrideTokens).toHaveBeenCalledTimes(1)
    expect(overrideTokens).toHaveBeenCalledWith(THEME_SOURCE, SIMPLIFY_TOKENS)
    expect(cleanups).toHaveLength(1)

    cleanups[0]()
    expect(disposeLayer).toHaveBeenCalledTimes(1)
  })
})
