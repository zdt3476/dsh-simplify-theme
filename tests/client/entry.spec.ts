import { describe, expect, it, vi } from 'vitest'
import { apply, inject, name } from '../../src/client/index'
import { SIMPLIFY_TOKENS, THEME_SOURCE } from '../../src/client/tokens'

/** 构造一个记录型 Client 上下文：apply 的每一步贡献都可断言。 */
function makeCtx() {
  const overrideTokens = vi.fn(() => () => {})
  const localeRegister = vi.fn(() => () => {})
  const effects: Array<{ name?: string; fn: () => void | (() => void) }> = []
  const slotInjects: Array<{ name: string }> = []
  const slotRegisters: Array<{ registration: Record<string, unknown>; component: unknown }> = []
  const ctx = {
    slots: {
      inject: vi.fn((slotName: string) => {
        slotInjects.push({ name: slotName })
      }),
      register: vi.fn((registration: Record<string, unknown>, component: unknown) => {
        slotRegisters.push({ registration, component })
      })
    },
    locale: {
      register: localeRegister,
      bind: vi.fn(() => (key: string) => key)
    },
    modelDirectories: undefined as never,
    remote: undefined as never,
    theme: { overrideTokens },
    effect: (fn: () => void | (() => void), effectName?: string) => {
      effects.push({ name: effectName, fn })
    },
    inject: vi.fn()
  }
  return { ctx, overrideTokens, localeRegister, effects, slotInjects, slotRegisters }
}

describe('client entry', () => {
  it('声明插件身份并依赖 slots/locale/modelDirectories/remote/theme', () => {
    expect(name).toBe('dsh-simplify-theme')
    for (const service of ['slots', 'locale', 'modelDirectories', 'remote', 'sessions', 'workspaces', 'theme']) {
      expect(inject).toContain(service)
    }
  })

  it('激活时注册唯一的 token 层，并把 disposer 交给 effect 管理', () => {
    const { ctx, overrideTokens, effects } = makeCtx()
    apply(ctx)

    const tokenEffect = effects.find((effect) => effect.name === 'simplify-theme: token layer')
    expect(tokenEffect).toBeDefined()
    for (const effect of effects) effect.fn()
    expect(overrideTokens).toHaveBeenCalledTimes(1)
    expect(overrideTokens).toHaveBeenCalledWith(THEME_SOURCE, SIMPLIFY_TOKENS)
  })

  it('注册 dock 控件、归档字典与模型标签 slot', () => {
    const { ctx, slotInjects, slotRegisters, localeRegister } = makeCtx()
    apply(ctx)

    const injected = slotInjects.map((entry) => entry.name)
    expect(injected).toContain('conversation.composer.dock')
    // 供应商前缀由 dock 模型 pill 承担；不再占用 label slot（避免 '·' 拼接观感）。
    expect(injected).not.toContain('conversation.input.model.label')

    expect(localeRegister).toHaveBeenCalledWith('dsh-simplify-theme', expect.objectContaining({
      zh: expect.objectContaining({ 'filter.placeholder': '筛选工作区或会话…', 'filter.ariaLabel': '筛选工作区或会话', 'effort.providerDefault': '默认' }),
      en: expect.objectContaining({ 'filter.placeholder': 'Filter workspaces or sessions…', 'effort.providerDefault': 'Default' })
    }))
  })
})
