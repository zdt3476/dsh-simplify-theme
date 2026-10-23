/**
 * dock 行百分比数据的配色。
 *
 * 原生统计项只给中性灰文字与描边，看不出好坏：缓存命中 95% 和上下文占用 95%
 * 在视觉上完全一样。这里按数值标注语义桶，样式表负责上色。
 * 两个指标方向相反——缓存命中越高越好，上下文占用越高越危险。
 */

export type PercentKind = 'cache' | 'context'
export type PercentBucket = 'good' | 'warn' | 'bad'

/** 从文本里取最后一个百分比数值；没有则返回 null。 */
export function readPercent(text: string): number | null {
  const matches = text.match(/(\d+(?:\.\d+)?)\s*%/g)
  if (matches === null) return null
  const value = Number(matches[matches.length - 1].replace('%', '').trim())
  return Number.isFinite(value) ? value : null
}

/**
 * 标注百分比语义桶。
 * @param kind `cache` 越高越好；`context` 越高越危险。
 * @param percent 0-100 的百分比。
 */
export function classifyPercent(kind: PercentKind, percent: number): PercentBucket {
  if (kind === 'cache') {
    if (percent >= 80) return 'good'
    if (percent >= 50) return 'warn'
    return 'bad'
  }
  if (percent <= 50) return 'good'
  if (percent <= 75) return 'warn'
  return 'bad'
}
