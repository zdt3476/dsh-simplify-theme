/**
 * 底部 composer 栏平铺统计控件。
 *
 * 将原本必须点击弹窗才能看到的关键指标平铺展开在底部 dock 中央：
 * - 上下文容量与占用（如 `121k / 500k (24%)`，支持警戒变色）
 * - 真实端到端 TPS（严格计入首字延迟与思考时间，不虚高）
 * - Prompt 缓存命中率（如 `缓存 82%`，支持绿色/中性/灰色分级）
 * - 最新一轮耗时（如 `4.2 秒`）
 * 鼠标悬停任意一项即可查看完整分解 Tooltip。
 */

import type { DockShared } from './dock-shared'
import {
  deriveComposerStats,
  type SessionStatsProjection,
  type TokenUsageProjection,
  type ContextPressureProjection
} from './composer-stats'

export interface DockStatsProps {
  useProjection?: (key: string) => unknown
}

export function createDockStats(shared: DockShared) {
  const { h, hooks } = shared

  return function DockStats(props: DockStatsProps) {
    const stats = props.useProjection?.('sessionStats') as SessionStatsProjection | undefined
    const usage = props.useProjection?.('tokenUsage') as TokenUsageProjection | undefined
    const pressure = props.useProjection?.('contextPressure') as ContextPressureProjection | undefined

    // 观察本轮最新耗时徽标（由 turn-duration.ts 挂在末轮操作行）
    const [latestDuration, setLatestDuration] = hooks.useState<string | null>(null)
    hooks.useEffect(() => {
      const readDuration = () => {
        const badges = document.querySelectorAll<HTMLElement>('[data-dsh-simplify-duration]')
        const text = badges[badges.length - 1]?.textContent?.trim() || null
        setLatestDuration(text)
      }
      readDuration()
      const timer = window.setInterval(readDuration, 1000)
      return () => window.clearInterval(timer)
    }, [])

    const model = deriveComposerStats(stats, usage, pressure)
    const items: unknown[] = []

    // 1. 上下文容量
    if (model.context) {
      const pctAttr = model.context.level === 'critical'
        ? 'bad'
        : model.context.level === 'warning'
          ? 'warn'
          : undefined
      items.push(
        h('span', {
          key: 'context',
          className: 'dsh-simplify-stat-item is-context',
          ...(pctAttr ? { 'data-dsh-simplify-pct': pctAttr, 'data-dsh-simplify-pct-kind': 'context' } : {}),
          title: model.context.tooltip
        }, model.context.label)
      )
    }

    // 2. 真实 TPS（包含首字延迟）
    if (model.tps) {
      if (items.length > 0) items.push(h('span', { key: 'sep-1', className: 'dsh-simplify-stat-sep', 'aria-hidden': 'true' }, '·'))
      items.push(
        h('span', {
          key: 'tps',
          className: 'dsh-simplify-stat-item is-tps',
          title: model.tps.tooltip
        }, model.tps.label)
      )
    }

    // 3. 缓存命中率
    if (model.cache) {
      if (items.length > 0) items.push(h('span', { key: 'sep-2', className: 'dsh-simplify-stat-sep', 'aria-hidden': 'true' }, '·'))
      items.push(
        h('span', {
          key: 'cache',
          className: 'dsh-simplify-stat-item is-cache',
          'data-dsh-simplify-pct': model.cache.bucket,
          'data-dsh-simplify-pct-kind': 'cache',
          title: model.cache.tooltip
        }, model.cache.label)
      )
    }

    // 4. 最新轮用时
    if (latestDuration) {
      if (items.length > 0) items.push(h('span', { key: 'sep-3', className: 'dsh-simplify-stat-sep', 'aria-hidden': 'true' }, '·'))
      items.push(
        h('span', {
          key: 'duration',
          className: 'dsh-simplify-stat-item is-duration',
          title: `最新一轮总耗时: ${latestDuration}`
        }, latestDuration)
      )
    }

    if (items.length === 0) return null

    return h('div', {
      className: 'dsh-simplify-dock-center',
      'data-dsh-simplify-dock-center': ''
    }, ...items)
  }
}
