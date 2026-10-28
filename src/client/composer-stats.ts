/**
 * 底部 composer 栏平铺统计的数据推导与格式化。
 *
 * 参考 PI-Desktop 上下文面板的核心指标体系，将原先隐藏在弹窗里的：
 * 1. 上下文容量占用与上限（已用 / 窗口上限 · 百分比）
 * 2. 真实端到端 TPS（严格包含首字延迟，不虚高）
 * 3. Prompt 缓存命中率（带颜色分级）
 * 4. 单轮最新用时
 * 平铺展示在底部栏，一眼纵览全局运行健康度。
 */

export interface SessionStatsProjection {
  turns?: number
  steps?: number
  llmMs?: number
  toolMs?: number
  ttftMs?: number
  ttftSteps?: number
  decodeMs?: number
  decodeTokens?: number
}

export interface TokenUsageBuckets {
  uncachedInputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

export interface TokenUsageProjection {
  totals?: TokenUsageBuckets
  last?: {
    turn?: number
    step?: number
    buckets?: TokenUsageBuckets
  }
}

export interface ContextPressureProjection {
  contextWindow?: number
  pressureTokens?: number
  surfaceTokens?: number
}

export type ContextLevel = 'comfortable' | 'warning' | 'critical'
export type CacheBucket = 'good' | 'warn' | 'bad'

export interface ContextCapacity {
  usedTokens: number
  contextWindow: number
  remainingTokens: number
  usedPercent: number
  level: ContextLevel
}

export interface ComposerStatsView {
  context: {
    usedTokens: number
    contextWindow: number
    usedPercent: number
    label: string
    level: ContextLevel
    tooltip: string
  } | null
  tps: {
    value: number
    label: string
    tooltip: string
  } | null
  cache: {
    percent: number
    label: string
    bucket: CacheBucket
    tooltip: string
  } | null
  duration: {
    ms: number
    label: string
    tooltip: string
  } | null
}

/** 紧凑格式化 Token 数量：如 492, 12.5k, 500k, 1.2M, 23.3M */
export function formatCompactTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return '0'
  if (tokens < 1000) return String(Math.round(tokens))
  if (tokens < 1_000_000) {
    const val = tokens / 1000
    // 小于 100k 保留 1 位小数，若为 .0 则去掉；大于等于 100k 取整
    const str = val < 100 ? val.toFixed(1).replace(/\.0$/, '') : String(Math.round(val))
    return `${str}k`
  }
  const val = tokens / 1_000_000
  const str = val.toFixed(val < 10 ? 1 : 1).replace(/\.0$/, '')
  return `${str}M`
}

/**
 * 计算真实端到端 TPS（严格包含首字延迟 TTFT）：
 * TPS = 输出 Tokens / (总生成耗时 秒)
 * 总生成耗时优先取 llmMs，退回 (decodeMs + ttftMs)。
 * 首字延迟（TTFT，包含排队与推理思考时间）坚决不剔除，确保反映真实感知吞吐率。
 */
export function calculateRealTps(stats: SessionStatsProjection | undefined): number | null {
  if (!stats) return null
  const tokens = stats.decodeTokens
  if (typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens <= 0) return null

  // 优先取模型总耗时 llmMs；若不存在则取 (decodeMs + ttftMs)
  const totalMs = (typeof stats.llmMs === 'number' && stats.llmMs > 0)
    ? stats.llmMs
    : ((stats.decodeMs ?? 0) + (stats.ttftMs ?? 0))

  if (totalMs <= 0 || !Number.isFinite(totalMs)) return null

  const raw = tokens / (totalMs / 1000)
  if (!Number.isFinite(raw) || raw <= 0) return null

  // 保留一位小数（例如 27.2 t/s）；若为整数则显示整数
  return Math.round(raw * 10) / 10
}

/**
 * 计算 Prompt 缓存命中率：
 * CacheRate = cacheReadTokens / (uncachedInputTokens + cacheReadTokens) * 100
 */
export function calculateCacheRate(
  inputTokens: number | undefined,
  cacheReadTokens: number | undefined
): number | null {
  if (typeof inputTokens !== 'number' || typeof cacheReadTokens !== 'number') return null
  if (!Number.isFinite(inputTokens) || !Number.isFinite(cacheReadTokens)) return null
  const totalInput = inputTokens + cacheReadTokens
  if (totalInput <= 0) return null
  return Math.round((cacheReadTokens / totalInput) * 100)
}

/** 计算上下文占用、上限及预警等级 */
export function calculateContextCapacity(
  pressure: ContextPressureProjection | undefined,
  usage?: TokenUsageProjection
): ContextCapacity | null {
  const windowLimit = pressure?.contextWindow
  if (typeof windowLimit !== 'number' || !Number.isFinite(windowLimit) || windowLimit <= 0) {
    return null
  }

  // 优先用 pressureTokens，备选用最新/累计输入输出总和
  const used = pressure?.pressureTokens
    ?? (usage?.totals
      ? (usage.totals.uncachedInputTokens ?? 0) + (usage.totals.cacheReadTokens ?? 0) + (usage.totals.outputTokens ?? 0)
      : undefined)

  if (typeof used !== 'number' || !Number.isFinite(used) || used <= 0) {
    return null
  }

  const usedRatio = Math.min(1, used / windowLimit)
  const usedPercent = Math.round(usedRatio * 100)
  const remainingTokens = Math.max(0, windowLimit - used)

  const level: ContextLevel = usedPercent >= 90
    ? 'critical'
    : usedPercent >= 75
      ? 'warning'
      : 'comfortable'

  return {
    usedTokens: used,
    contextWindow: windowLimit,
    remainingTokens,
    usedPercent,
    level
  }
}

/** 格式化耗时展示 */
function formatSimpleDuration(ms: number): string {
  const s = ms / 1000
  if (s < 60) return `${Math.round(s * 10) / 10} 秒`
  const minutes = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  return rem === 0 ? `${minutes} 分` : `${minutes} 分 ${rem} 秒`
}

/** 从各投影推导平铺状态栏展示模型 */
export function deriveComposerStats(
  stats?: SessionStatsProjection,
  usage?: TokenUsageProjection,
  pressure?: ContextPressureProjection,
  latestDurationMs?: number
): ComposerStatsView {
  // 1. 上下文容量
  const capacity = calculateContextCapacity(pressure, usage)
  let contextView: ComposerStatsView['context'] = null
  if (capacity !== null) {
    const compactUsed = formatCompactTokens(capacity.usedTokens)
    const compactWindow = formatCompactTokens(capacity.contextWindow)
    const lastInput = usage?.last?.buckets?.uncachedInputTokens ?? 0
    const lastCache = usage?.last?.buckets?.cacheReadTokens ?? 0
    const lastOut = usage?.last?.buckets?.outputTokens ?? 0

    contextView = {
      usedTokens: capacity.usedTokens,
      contextWindow: capacity.contextWindow,
      usedPercent: capacity.usedPercent,
      label: `${compactUsed} / ${compactWindow} (${capacity.usedPercent}%)`,
      level: capacity.level,
      tooltip: `上下文容量: 已用 ${capacity.usedTokens.toLocaleString()} / 上限 ${capacity.contextWindow.toLocaleString()} (剩余 ${capacity.remainingTokens.toLocaleString()} tokens)${lastInput || lastCache || lastOut ? `\n最新单轮: 输入 ${formatCompactTokens(lastInput)} · 缓存读 ${formatCompactTokens(lastCache)} · 输出 ${formatCompactTokens(lastOut)}` : ''}`
    }
  }

  // 2. 真实 TPS（包含首字延迟）
  const tpsVal = calculateRealTps(stats)
  let tpsView: ComposerStatsView['tps'] = null
  if (tpsVal !== null && stats) {
    const avgTtft = stats.ttftSteps && stats.ttftSteps > 0
      ? `${(stats.ttftMs! / stats.ttftSteps / 1000).toFixed(1)}s`
      : '无'
    const rawTps = stats.decodeMs && stats.decodeMs > 0 && stats.decodeTokens
      ? `${(stats.decodeTokens / (stats.decodeMs / 1000)).toFixed(1)} t/s`
      : '无'

    tpsView = {
      value: tpsVal,
      label: `${tpsVal} t/s`,
      tooltip: `端到端生成速率（含首字延迟/思考等待）\n会话总产出: ${(stats.decodeTokens ?? 0).toLocaleString()} tokens\n平均首字延迟: ${avgTtft}\n纯流式吐字速率: ${rawTps}`
    }
  }

  // 3. 缓存命中率
  const inputTokens = usage?.totals?.uncachedInputTokens
  const cacheReadTokens = usage?.totals?.cacheReadTokens
  const cacheRate = calculateCacheRate(inputTokens, cacheReadTokens)
  let cacheView: ComposerStatsView['cache'] = null
  if (cacheRate !== null && inputTokens !== undefined && cacheReadTokens !== undefined) {
    const bucket: CacheBucket = cacheRate >= 80 ? 'good' : cacheRate >= 50 ? 'warn' : 'bad'
    cacheView = {
      percent: cacheRate,
      label: `缓存 ${cacheRate}%`,
      bucket,
      tooltip: `Prompt 缓存命中率: ${cacheRate}%\n累计缓存读取: ${cacheReadTokens.toLocaleString()} tokens\n累计未缓存输入: ${inputTokens.toLocaleString()} tokens`
    }
  }

  // 4. 单轮耗时
  let durationView: ComposerStatsView['duration'] = null
  if (typeof latestDurationMs === 'number' && latestDurationMs > 0) {
    durationView = {
      ms: latestDurationMs,
      label: formatSimpleDuration(latestDurationMs),
      tooltip: `最新一轮总用时: ${formatSimpleDuration(latestDurationMs)}`
    }
  }

  return {
    context: contextView,
    tps: tpsView,
    cache: cacheView,
    duration: durationView
  }
}
