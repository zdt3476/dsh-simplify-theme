/**
 * 本地化枚举值。
 *
 * 目录里的模型名、供应商名来自宿主，必须原样展示；但思考档位 id、供应商 id
 * 和权限预设是固定枚举，其中文名由本插件负责，否则界面会出现 minimal / Auto
 * 这类英文词。
 */

/** 思考档位 id → 中文；宿主已给出中文名时不覆盖。 */
const EFFORT_NAMES: Record<string, string> = {
  minimal: '极简',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '极高',
  max: '最高',
  none: '关闭'
}

const PROVIDER_NAMES: Record<string, string> = {
  'deepseek-official': 'DeepSeek 官方',
  'deepseek-account': 'DeepSeek 账号'
}

const ASCII_WORD = /^[a-z0-9]+(-[a-z0-9]+)*$/i

/** 档位展示名：宿主没给名字或只给了英文 id 时换成中文。 */
export function effortName(id: string | undefined, name: string | undefined): string {
  if (name !== undefined && name !== '' && name.trim().toLowerCase() !== id) return name
  if (id === undefined) return name ?? ''
  return EFFORT_NAMES[id] ?? name ?? id
}

/** 供应商展示名：内置两个 DeepSeek 供应商用中文名，其它保持宿主原文。 */
export function providerName(id: string, name: string): string {
  const localized = PROVIDER_NAMES[id]
  if (localized !== undefined && (name === id || ASCII_WORD.test(name))) return localized
  return name
}
