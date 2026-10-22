/**
 * 极简主题的 token 层。
 *
 * 只覆盖「视觉噪音」来源，不碰语义色（品牌蓝、状态色、焦点环）和字号：
 *   - 去投影、去毛玻璃：菜单改成不透明实底，elevation 只留一圈发丝描边；
 *   - 收紧圆角并关掉 superellipse，回到规整的圆角；
 *   - 气泡、hover/active 改用中性灰，不再用品牌色染色。
 *
 * 未列出的 token 一律继承内置亮暗配色，因此内置主题升级后新增的 token
 * 会自动生效，不需要在这里跟进。值必须是 { light, dark } 对：单个值在
 * 用户切换配色后会直接不可读。
 */

/** 一个 token 在两种配色下的值。 */
export interface ThemeTokenValue {
  readonly light: string
  readonly dark: string
}

export type ThemeTokens = Readonly<Record<string, ThemeTokenValue>>

/** override 层的身份；同一 source 重复注册会整体替换旧层。 */
export const THEME_SOURCE = 'dsh-simplify-theme'

export const SIMPLIFY_TOKENS: ThemeTokens = Object.freeze({
  // 圆角：更小、更规整。
  '--dsw-corner-shape': { light: 'round', dark: 'round' },
  '--dsw-radius-xs': { light: '3px', dark: '3px' },
  '--dsw-radius-sm': { light: '6px', dark: '6px' },
  '--dsw-radius-md': { light: '8px', dark: '8px' },
  '--dsw-radius-lg': { light: '12px', dark: '12px' },
  '--dsw-radius-xl': { light: '16px', dark: '16px' },
  '--dsw-radius-panel': { light: '20px', dark: '20px' },

  // 阴影：全部去掉，浮层只靠描边和背景区分。
  '--dsw-shadow-lv1': { light: 'none', dark: 'none' },
  '--dsw-shadow-lv1-blur': { light: 'none', dark: 'none' },
  '--dsw-shadow-lv2': { light: 'none', dark: 'none' },
  '--dsw-shadow-lv3': { light: 'none', dark: 'none' },
  '--dsw-elevation-panel': { light: 'var(--dsw-elevation-stroke)', dark: 'var(--dsw-elevation-stroke)' },
  '--dsw-elevation-prominent': { light: 'var(--dsw-elevation-stroke)', dark: 'var(--dsw-elevation-stroke)' },
  '--dsw-elevation-soft': { light: 'var(--dsw-elevation-stroke)', dark: 'var(--dsw-elevation-stroke)' },

  // 菜单：实底、不模糊，标题行与菜单同色。
  '--dsw-menu-backdrop-filter': { light: 'none', dark: 'none' },
  '--dsw-menu-surface-fill': { light: '#ffffff', dark: '#1c1d1f' },
  '--dsw-alias-menu-group-header-fill': { light: '#ffffff', dark: '#1c1d1f' },
  '--dsw-specific-menu': { light: 'var(--dsw-menu-surface-fill)', dark: 'var(--dsw-menu-surface-fill)' },

  // 交互态：中性灰，不做冷色叠加。
  '--dsw-alias-interactive-bg-hover': { light: '#2631480d', dark: '#ffffff12' },
  '--dsw-alias-interactive-bg-active': { light: '#26314817', dark: '#ffffff1f' },

  // 用户气泡：中性表面，保留对比度但不带品牌色。
  '--dsw-specific-bubble': { light: '#f5f6f8', dark: '#232528' },
  '--dsw-specific-bubble-highlight': { light: '#e9ebef', dark: '#2f3237' },

  // 代码块：贴近画布的中性底，减少大面积色块。
  '--dsw-alias-markdown-code-block': { light: '#f7f8fa', dark: '#1b1c1f' },
  '--dsw-alias-markdown-code-block-banner': { light: '#f7f8fa', dark: '#1b1c1f' },
  '--dsw-alias-markdown-inline-code': { light: '#f1f3f5', dark: '#26282c' },
})
