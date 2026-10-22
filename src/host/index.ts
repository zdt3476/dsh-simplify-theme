/**
 * 极简主题 —— Host 侧入口。
 *
 * 主题是纯 Client 能力：Host 侧不读配置、不持久化状态、不注册路由。
 * 这里保留一个空插件只是为了让 profile 的 patch 能把包挂进 Loader，
 * 从而让 `dsh.client` 声明被 client-modules 扫描并下发给浏览器。
 */

export const name = 'dsh-simplify-theme'

export function apply(): void {}
