/**
 * 底部 composer 栏平铺统计控件。
 *
 * 将原本隐藏在弹窗里的关键指标平铺展开在底部 dock 中央：
 * - 会话规模（如 `9 轮 · 126 步`）
 * - 上下文容量与占用（如 `121k / 500k (24%)`，支持警戒变色）
 * - 真实端到端 TPS（严格计入首字延迟与思考时间，不虚高）
 * - Prompt 缓存命中率（如 `缓存 99%`，支持绿色/中性/灰色分级）
 * - 最新一轮耗时（如 `4.2 秒`）
 *
 * 交互支持：
 * - 点击平铺条即可展开沉浸式结构化上下文与性能看板浮层（参考 PI-Desktop ContextUsageInspector）
 * - 悬停提供清晰 Tooltip 提示，按 Escape 或点击外部区域自动关闭浮层
 */

import type { DockShared } from './dock-shared'
import { useDismiss } from './dock-shared'
import { placePopup, measurePopup, type Placement } from './popup'
import {
  deriveComposerStats,
  formatCompactTokens,
  formatSimpleDuration,
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
    const breakdown = props.useProjection?.('contextBreakdown') as import('./composer-stats').ContextBreakdownProjection | undefined

    const [open, setOpen] = hooks.useState(false)
    const [pos, setPos] = hooks.useState<Placement | null>(null)
    const triggerRef = hooks.useRef<HTMLButtonElement | null>(null)
    const popupRef = hooks.useRef<HTMLDivElement | null>(null)

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

    const model = deriveComposerStats(stats, usage, pressure, undefined, breakdown)

    // 弹层定位在 dock 中央上方
    hooks.useEffect(() => {
      if (!open) {
        setPos(null)
        return
      }
      const trigger = triggerRef.current
      const popup = popupRef.current
      if (trigger === null || popup === null) return
      const rect = trigger.getBoundingClientRect()
      const size = measurePopup(popup)
      setPos(placePopup(
        { left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top },
        size,
        { width: window.innerWidth, height: window.innerHeight },
        'center',
        'top'
      ))
    }, [open, stats, usage, pressure, breakdown])

    hooks.useEffect(() => {
      if (!open) return
      const onResize = () => setOpen(false)
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [open])

    useDismiss(shared, () => setOpen(false), open)

    const items: unknown[] = []

    // 1. 会话活动（轮数 · 步数）
    if (model.activity) {
      items.push(
        h('span', {
          key: 'activity',
          className: 'dsh-simplify-stat-item is-activity'
        }, model.activity.label)
      )
    }

    // 2. 上下文容量
    if (model.context) {
      if (items.length > 0) items.push(h('span', { key: 'sep-ctx', className: 'dsh-simplify-stat-sep', 'aria-hidden': 'true' }, '·'))
      items.push(
        h('span', {
          key: 'context',
          className: 'dsh-simplify-stat-item is-context',
          'data-dsh-simplify-pct': model.context.bucket,
          'data-dsh-simplify-pct-kind': 'context'
        }, model.context.label)
      )
    }

    // 3. 真实 TPS（包含首字延迟）
    if (model.tps) {
      if (items.length > 0) items.push(h('span', { key: 'sep-tps', className: 'dsh-simplify-stat-sep', 'aria-hidden': 'true' }, '·'))
      items.push(
        h('span', {
          key: 'tps',
          className: 'dsh-simplify-stat-item is-tps'
        }, model.tps.label)
      )
    }

    // 4. 缓存命中率
    if (model.cache) {
      if (items.length > 0) items.push(h('span', { key: 'sep-cache', className: 'dsh-simplify-stat-sep', 'aria-hidden': 'true' }, '·'))
      items.push(
        h('span', {
          key: 'cache',
          className: 'dsh-simplify-stat-item is-cache',
          'data-dsh-simplify-pct': model.cache.bucket,
          'data-dsh-simplify-pct-kind': 'cache'
        }, model.cache.label)
      )
    }

    // 5. 耗时展示（优先单轮最新耗时，无单轮耗时则展示模型累计总耗时）
    const durationText = latestDuration ?? model.duration?.label
    if (durationText) {
      if (items.length > 0) items.push(h('span', { key: 'sep-dur', className: 'dsh-simplify-stat-sep', 'aria-hidden': 'true' }, '·'))
      items.push(
        h('span', {
          key: 'duration',
          className: 'dsh-simplify-stat-item is-duration'
        }, durationText)
      )
    }

    if (items.length === 0) return null

    // 构建展开的看板浮层内容
    const popoverContent = open ? h('div', {
      ref: popupRef,
      className: 'dsh-simplify-stats-popover',
      'data-dsh-simplify-stats-popover': '',
      style: pos ? { left: `${pos.left}px`, top: `${pos.top}px` } : { visibility: 'hidden' }
    },
      // 头部
      h('div', { className: 'dsh-simplify-stats-popover-head' },
        h('span', { className: 'dsh-simplify-stats-popover-title' }, '会话用量与性能看板'),
        model.context ? h('span', {
          className: 'dsh-simplify-stats-popover-badge',
          'data-bucket': model.context.bucket
        }, `${model.context.usedPercent}% 已用`) : null
      ),

      // 1. 上下文容量进度条
      model.context ? h('div', { className: 'dsh-simplify-stats-section' },
        h('div', { className: 'dsh-simplify-stats-progress-header' },
          h('span', {}, '上下文容量占用'),
          h('strong', {}, `${formatCompactTokens(model.context.usedTokens)} / ${formatCompactTokens(model.context.contextWindow)}`)
        ),
        h('div', { className: 'dsh-simplify-stats-progress-track' },
          model.context.breakdown && model.context.breakdown.totalTokens > 0 ? [
            h('div', {
              key: 'seg-sys',
              className: 'dsh-simplify-stats-progress-fill is-segment is-system',
              title: `系统提示词: ${model.context.breakdown.systemTokens.toLocaleString()} tokens`,
              style: { width: `${Math.min(100, (model.context.breakdown.systemTokens / model.context.contextWindow) * 100)}%` }
            }),
            h('div', {
              key: 'seg-tools',
              className: 'dsh-simplify-stats-progress-fill is-segment is-tools',
              title: `工具定义: ${model.context.breakdown.toolsTokens.toLocaleString()} tokens`,
              style: { width: `${Math.min(100, (model.context.breakdown.toolsTokens / model.context.contextWindow) * 100)}%` }
            }),
            h('div', {
              key: 'seg-messages',
              className: 'dsh-simplify-stats-progress-fill is-segment is-messages',
              title: `对话与压缩历史: ${model.context.breakdown.messageTokens.toLocaleString()} tokens`,
              style: { width: `${Math.min(100, (model.context.breakdown.messageTokens / model.context.contextWindow) * 100)}%` }
            })
          ] : h('div', {
            className: 'dsh-simplify-stats-progress-fill',
            'data-bucket': model.context.bucket,
            style: { width: `${Math.min(100, Math.max(0, model.context.usedPercent))}%` }
          })
        ),
        model.context.breakdown && model.context.breakdown.totalTokens > 0 ? h('div', { className: 'dsh-simplify-stats-breakdown-legend' },
          h('span', { className: 'dsh-simplify-legend-chip is-system' }, `系统 ${formatCompactTokens(model.context.breakdown.systemTokens)}`),
          h('span', { className: 'dsh-simplify-legend-chip is-tools' }, `工具 ${formatCompactTokens(model.context.breakdown.toolsTokens)}`),
          h('span', { className: 'dsh-simplify-legend-chip is-messages' }, `消息 ${formatCompactTokens(model.context.breakdown.messageTokens)}`)
        ) : null,
        h('div', { className: 'dsh-simplify-stats-progress-footer' },
          h('span', {}, `剩余空间: ${model.context.remainingTokens.toLocaleString()} tokens`),
          h('span', {}, `上限: ${model.context.contextWindow.toLocaleString()}`)
        )
      ) : null,

      // 2. 核心性能指标卡片 (2x2)
      h('div', { className: 'dsh-simplify-stats-grid' },
        h('div', { className: 'dsh-simplify-stats-card' },
          h('span', { className: 'dsh-simplify-stats-card-k' }, '真实端到端 TPS'),
          h('strong', { className: 'dsh-simplify-stats-card-v is-highlight' }, model.tps ? model.tps.label : '0 t/s'),
          h('span', { className: 'dsh-simplify-stats-card-hint' }, `流式解码: ${model.tps?.rawDecodeTps ?? '无'}`)
        ),
        h('div', { className: 'dsh-simplify-stats-card' },
          h('span', { className: 'dsh-simplify-stats-card-k' }, 'Prompt 缓存命中率'),
          h('strong', {
            className: 'dsh-simplify-stats-card-v',
            'data-dsh-simplify-pct': model.cache?.bucket ?? 'bad'
          }, model.cache ? `${model.cache.percent}%` : '0%'),
          h('span', { className: 'dsh-simplify-stats-card-hint' }, `读取: ${formatCompactTokens(model.tokensDetail?.cacheReadTokens ?? 0)}`)
        ),
        h('div', { className: 'dsh-simplify-stats-card' },
          h('span', { className: 'dsh-simplify-stats-card-k' }, '平均首字延迟 (TTFT)'),
          h('strong', { className: 'dsh-simplify-stats-card-v' }, model.tps?.avgTtft ?? '0.0s'),
          h('span', { className: 'dsh-simplify-stats-card-hint' }, '含网络/推理思考耗时')
        ),
        h('div', { className: 'dsh-simplify-stats-card' },
          h('span', { className: 'dsh-simplify-stats-card-k' }, latestDuration ? '单轮最新总耗时' : '模型累计总耗时'),
          h('strong', { className: 'dsh-simplify-stats-card-v' }, latestDuration ?? (model.duration ? model.duration.label : '无')),
          h('span', { className: 'dsh-simplify-stats-card-hint' }, latestDuration ? '包含排队与流式等待' : (stats?.turns ? `平均每轮 ${formatSimpleDuration((model.timingDetail?.llmMs ?? 0) / Math.max(1, stats.turns))}` : '模型总耗时'))
        )
      ),

      // 3. Token 明细列表
      model.tokensDetail ? h('div', { className: 'dsh-simplify-stats-detail-list' },
        h('div', { className: 'dsh-simplify-stats-detail-row' },
          h('span', {}, '未缓存输入 Tokens'),
          h('strong', {}, model.tokensDetail.uncachedInputTokens.toLocaleString())
        ),
        h('div', { className: 'dsh-simplify-stats-detail-row' },
          h('span', {}, '缓存读取 Tokens (Cache Read)'),
          h('strong', {}, model.tokensDetail.cacheReadTokens.toLocaleString())
        ),
        model.tokensDetail.cacheWriteTokens > 0 ? h('div', { className: 'dsh-simplify-stats-detail-row' },
          h('span', {}, '缓存写入 Tokens (Cache Write)'),
          h('strong', {}, model.tokensDetail.cacheWriteTokens.toLocaleString())
        ) : null,
        h('div', { className: 'dsh-simplify-stats-detail-row' },
          h('span', {}, '模型输出 Tokens (含思考内容)'),
          h('strong', {}, model.tokensDetail.outputTokens.toLocaleString())
        ),
        h('div', { className: 'dsh-simplify-stats-detail-row is-total' },
          h('span', {}, '累计消耗总 Tokens'),
          h('strong', {}, model.tokensDetail.totalTokens.toLocaleString())
        )
      ) : null,

      // 4. 会话活动与耗时拆解
      h('div', { className: 'dsh-simplify-stats-footer' },
        model.activity ? h('div', {}, `会话累计活动: ${model.activity.turns} 轮 · ${model.activity.steps} 步骤`) : null,
        model.timingDetail ? h('div', {}, `模型总耗时 ${formatSimpleDuration(model.timingDetail.llmMs)}${model.timingDetail.toolMs > 0 ? ` · 工具耗时 ${formatSimpleDuration(model.timingDetail.toolMs)}` : ''}`) : null
      )
    ) : null

    return h('div', {
      className: 'dsh-simplify-dock-center-container',
      'data-dsh-simplify-dock-center': '',
      'data-dsh-simplify-dock-root': ''
    },
      h('button', {
        ref: triggerRef,
        type: 'button',
        className: 'dsh-simplify-dock-stats-trigger',
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        title: '点击展开会话用量与性能看板',
        onClick: () => setOpen(!open)
      }, ...items),
      popoverContent
    )
  }
}
