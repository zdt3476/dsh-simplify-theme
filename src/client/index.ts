/**
 * 极简主题 —— Client 侧入口。
 *
 * 通过 `ctx.theme.overrideTokens()` 在用户当前的 light / dark / system
 * 之上叠一层 token，而不是注册一个新的主题 id：DSH 的 Appearance 只列
 * light / dark / system 三个内置项，注册的第三方 id 没有选择入口，也无法
 * 跟随系统配色。token 层会随主题服务重建快照自动重算，卸载时由 disposer
 * 整体移除。
 */

import { SIMPLIFY_TOKENS, THEME_SOURCE } from './tokens'

export interface ThemeService {
  /** 叠一层 token；返回移除该层的 disposer。 */
  overrideTokens: (source: string, tokens: typeof SIMPLIFY_TOKENS) => () => void
}

export interface ClientCtx {
  theme: ThemeService
  effect: (fn: () => void | (() => void), name?: string) => void
}

export const name = 'dsh-simplify-theme'

/** 必须先拿到 theme 服务；cordis 会等 ui-theme 提供后再执行 apply。 */
export const inject = ['theme']

export function apply(ctx: ClientCtx): void {
  ctx.effect(() => ctx.theme.overrideTokens(THEME_SOURCE, SIMPLIFY_TOKENS), 'simplify-theme: token layer')
}
