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

import { classifyPercent, type PercentBucket } from './stat-colors'

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
  projectedTokens?: number
  surfaceTokens?: number
  sampledSurfaceTokens?: number
}

export interface ContextBreakdownProjection {
  systemTokens?: number
  toolsTokens?: number
  messageTokens?: number
}

export type ContextLevel = 'comfortable' | 'warning' | 'critical'
export type CacheBucket = 'good' | 'warn' | 'bad'

export interface ContextCapacity {
  usedTokens: number
  contextWindow: number
  remainingTokens: number
  usedPercent: number
  level: ContextLevel
  bucket: PercentBucket
  breakdown?: {
    systemTokens: number
    toolsTokens: number
    messageTokens: number
    totalTokens: number
  }
}

export interface ComposerStatsView {
  activity: {
    turns: number
    steps: number
    label: string
  } | null
  context: {
    usedTokens: number
    contextWindow: number
    remainingTokens: number
    usedPercent: number
    label: string
    level: ContextLevel
    bucket: PercentBucket
    tooltip: string
    breakdown?: {
      systemTokens: number
      toolsTokens: number
      messageTokens: number
      totalTokens: number
    }
  } | null
  tps: {
    value: number
    label: string
    rawDecodeTps?: string
    avgTtft?: string
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
  tokensDetail: {
    uncachedInputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    outputTokens: number
    totalTokens: number
  } | null
  timingDetail: {
    llmMs: number
    toolMs: number
    totalMs: number
    ttftMs: number
    decodeMs: number
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

export interface ExtractedTokenUsage {
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  totalTokens: number
  cacheRate: number | null
}

/** 规范化提取 tokenUsage（兼容平铺与嵌套两种格式） */
export function extractTokenUsage(usage: unknown): ExtractedTokenUsage | null {
  if (!usage || typeof usage !== 'object') return null
  const obj = usage as Record<string, unknown>
  const target = (obj.val && typeof obj.val === 'object')
    ? (obj.val as Record<string, unknown>)
    : obj

  const source = (target.totals && typeof target.totals === 'object')
    ? (target.totals as Record<string, unknown>)
    : target

  const uncached = typeof source.uncachedInputTokens === 'number' ? source.uncachedInputTokens : 0
  const cacheRead = typeof source.cacheReadTokens === 'number' ? source.cacheReadTokens : 0
  const cacheWrite = typeof source.cacheWriteTokens === 'number' ? source.cacheWriteTokens : 0
  const output = typeof source.outputTokens === 'number' ? source.outputTokens : 0
  const total = uncached + cacheRead + cacheWrite + output

  if (total <= 0) return null

  const promptTotal = uncached + cacheRead
  const cacheRate = promptTotal > 0 ? Math.round((cacheRead / promptTotal) * 100) : null

  return {
    uncachedInputTokens: uncached,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: output,
    totalTokens: total,
    cacheRate
  }
}

/** 计算上下文占用、上限及预警等级 */
export function calculateContextCapacity(
  pressure: ContextPressureProjection | undefined,
  usage?: TokenUsageProjection | unknown,
  breakdown?: ContextBreakdownProjection
): ContextCapacity | null {
  const windowLimit = pressure?.contextWindow
  if (typeof windowLimit !== 'number' || !Number.isFinite(windowLimit) || windowLimit <= 0) {
    return null
  }

  // projectedTokens 实时反映上下文压缩与裁剪后的真实尺寸；pressureTokens 为上一次 LLM 请求采样时的尺寸
  const extracted = extractTokenUsage(usage)
  const breakdownSum = breakdown
    ? ((breakdown.systemTokens ?? 0) + (breakdown.toolsTokens ?? 0) + (breakdown.messageTokens ?? 0))
    : 0

  const used = pressure?.projectedTokens
    ?? pressure?.pressureTokens
    ?? (breakdownSum > 0 ? breakdownSum : undefined)
    ?? extracted?.totalTokens

  if (typeof used !== 'number' || !Number.isFinite(used) || used <= 0) {
    return null
  }

  const usedRatio = Math.min(1, used / windowLimit)
  const usedPercent = Math.round(usedRatio * 100)
  const remainingTokens = Math.max(0, windowLimit - used)

  const bucket: PercentBucket = classifyPercent('context', usedPercent)
  const level: ContextLevel = bucket === 'bad' ? 'critical' : bucket === 'warn' ? 'warning' : 'comfortable'

  const breakdownDetail = breakdown && (breakdown.systemTokens !== undefined || breakdown.toolsTokens !== undefined || breakdown.messageTokens !== undefined)
    ? {
        systemTokens: breakdown.systemTokens ?? 0,
        toolsTokens: breakdown.toolsTokens ?? 0,
        messageTokens: breakdown.messageTokens ?? 0,
        totalTokens: (breakdown.systemTokens ?? 0) + (breakdown.toolsTokens ?? 0) + (breakdown.messageTokens ?? 0)
      }
    : undefined

  return {
    usedTokens: used,
    contextWindow: windowLimit,
    remainingTokens,
    usedPercent,
    level,
    bucket,
    breakdown: breakdownDetail
  }
}

/** 格式化耗时展示 */
export function formatSimpleDuration(ms: number): string {
  const s = ms / 1000
  if (s < 1) return `${Math.max(1, Math.round(ms))} 毫秒`
  if (s < 60) return `${Math.round(s * 10) / 10} 秒`
  const minutes = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  if (minutes < 60) return rem === 0 ? `${minutes} 分` : `${minutes} 分 ${rem} 秒`
  const hours = Math.floor(minutes / 60)
  const remM = minutes % 60
  return remM === 0 ? `${hours} 小时` : `${hours} 小时 ${remM} 分`
}

/** 从各投影推导平铺状态栏展示模型 */
export function deriveComposerStats(
  stats?: SessionStatsProjection,
  usage?: TokenUsageProjection,
  pressure?: ContextPressureProjection,
  latestDurationMs?: number,
  breakdown?: ContextBreakdownProjection
): ComposerStatsView {
  // 1. 会话活动（轮数 · 步数）
  let activityView: ComposerStatsView['activity'] = null
  if (stats && ((stats.turns ?? 0) > 0 || (stats.steps ?? 0) > 0)) {
    const turns = stats.turns ?? 0
    const steps = stats.steps ?? 0
    activityView = {
      turns,
      steps,
      label: `${turns} 轮 · ${steps} 步`
    }
  }

  // 2. 上下文容量
  const capacity = calculateContextCapacity(pressure, usage, breakdown)
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
      remainingTokens: capacity.remainingTokens,
      usedPercent: capacity.usedPercent,
      label: `${compactUsed} / ${compactWindow} (${capacity.usedPercent}%)`,
      level: capacity.level,
      bucket: capacity.bucket,
      tooltip: `上下文容量: 已用 ${capacity.usedTokens.toLocaleString()} / 上限 ${capacity.contextWindow.toLocaleString()} (剩余 ${capacity.remainingTokens.toLocaleString()} tokens)${lastInput || lastCache || lastOut ? `\n最新单轮: 输入 ${formatCompactTokens(lastInput)} · 缓存读 ${formatCompactTokens(lastCache)} · 输出 ${formatCompactTokens(lastOut)}` : ''}`,
      breakdown: capacity.breakdown
    }
  }

  // 3. 真实 TPS（包含首字延迟）
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
      rawDecodeTps: rawTps,
      avgTtft,
      tooltip: `端到端生成速率（含首字延迟/思考等待）\n会话总产出: ${(stats.decodeTokens ?? 0).toLocaleString()} tokens\n平均首字延迟: ${avgTtft}\n纯流式吐字速率: ${rawTps}`
    }
  }

  // 4. 缓存命中率与 Token 详细构成
  const tokenUsageInfo = extractTokenUsage(usage)
  let cacheView: ComposerStatsView['cache'] = null
  let tokensDetail: ComposerStatsView['tokensDetail'] = null

  if (tokenUsageInfo !== null) {
    tokensDetail = {
      uncachedInputTokens: tokenUsageInfo.uncachedInputTokens,
      cacheReadTokens: tokenUsageInfo.cacheReadTokens,
      cacheWriteTokens: tokenUsageInfo.cacheWriteTokens,
      outputTokens: tokenUsageInfo.outputTokens,
      totalTokens: tokenUsageInfo.totalTokens
    }
    if (tokenUsageInfo.cacheRate !== null) {
      const bucket: CacheBucket = tokenUsageInfo.cacheRate >= 80 ? 'good' : tokenUsageInfo.cacheRate >= 50 ? 'warn' : 'bad'
      cacheView = {
        percent: tokenUsageInfo.cacheRate,
        label: `缓存 ${tokenUsageInfo.cacheRate}%`,
        bucket,
        tooltip: `Prompt 缓存命中率: ${tokenUsageInfo.cacheRate}%\n累计缓存读取: ${tokenUsageInfo.cacheReadTokens.toLocaleString()} tokens\n累计未缓存输入: ${tokenUsageInfo.uncachedInputTokens.toLocaleString()} tokens`
      }
    }
  }

  // 5. 耗时展示（优先单轮最新耗时，若无则回退至模型累计耗时）
  let durationView: ComposerStatsView['duration'] = null
  if (typeof latestDurationMs === 'number' && latestDurationMs > 0) {
    durationView = {
      ms: latestDurationMs,
      label: formatSimpleDuration(latestDurationMs),
      tooltip: `最新一轮总用时: ${formatSimpleDuration(latestDurationMs)}`
    }
  } else if (stats && (stats.llmMs ?? 0) > 0) {
    const totalLlm = stats.llmMs!
    durationView = {
      ms: totalLlm,
      label: formatSimpleDuration(totalLlm),
      tooltip: `模型累计总耗时: ${formatSimpleDuration(totalLlm)}${stats.turns ? ` (平均每轮 ${formatSimpleDuration(totalLlm / stats.turns)})` : ''}`
    }
  }

  // 6. 详细耗时分解
  let timingDetail: ComposerStatsView['timingDetail'] = null
  if (stats && ((stats.llmMs ?? 0) > 0 || (stats.toolMs ?? 0) > 0)) {
    const llm = stats.llmMs ?? 0
    const tool = stats.toolMs ?? 0
    timingDetail = {
      llmMs: llm,
      toolMs: tool,
      totalMs: llm + tool,
      ttftMs: stats.ttftMs ?? 0,
      decodeMs: stats.decodeMs ?? 0
    }
  }

  return {
    activity: activityView,
    context: contextView,
    tps: tpsView,
    cache: cacheView,
    duration: durationView,
    tokensDetail,
    timingDetail
  }
}
