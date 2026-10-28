import { describe, expect, it } from 'vitest'
import {
  calculateRealTps,
  calculateCacheRate,
  calculateContextCapacity,
  formatCompactTokens,
  deriveComposerStats,
  type SessionStatsProjection,
  type TokenUsageProjection,
  type ContextPressureProjection
} from '../../src/client/composer-stats'

describe('formatCompactTokens', () => {
  it('格式化千与百万', () => {
    expect(formatCompactTokens(0)).toBe('0')
    expect(formatCompactTokens(492)).toBe('492')
    expect(formatCompactTokens(1200)).toBe('1.2k')
    expect(formatCompactTokens(121_055)).toBe('121k')
    expect(formatCompactTokens(500_000)).toBe('500k')
    expect(formatCompactTokens(1_500_000)).toBe('1.5M')
    expect(formatCompactTokens(23_333_115)).toBe('23.3M')
  })
})

describe('calculateRealTps (包含首字延迟)', () => {
  it('计算包含首字延迟的真实 TPS', () => {
    // 假设输出 100 tokens，首字延迟 8000ms，流式解码 2000ms，总耗时 10s
    const stats: SessionStatsProjection = {
      decodeTokens: 100,
      ttftMs: 8000,
      decodeMs: 2000,
      llmMs: 10000
    }
    // 原生算法会算出 100 / 2 = 50 t/s（虚高）
    // 包含首字延迟的真实算法为 100 / (8 + 2) = 10 t/s
    expect(calculateRealTps(stats)).toBe(10)
  })

  it('使用真实会话真实数据计算（非 0，不虚高）', () => {
    const stats: SessionStatsProjection = {
      decodeTokens: 116532,
      ttftMs: 3704044,
      decodeMs: 570592,
      llmMs: 4291888
    }
    // 116532 / (4291888 / 1000) = 27.15... -> 27.2 t/s
    expect(calculateRealTps(stats)).toBe(27.2)
  })

  it('异常与边界条件返回 null', () => {
    expect(calculateRealTps(undefined)).toBeNull()
    expect(calculateRealTps({ decodeTokens: 0, llmMs: 1000 })).toBeNull()
    expect(calculateRealTps({ decodeTokens: 100, llmMs: 0, decodeMs: 0, ttftMs: 0 })).toBeNull()
  })
})

describe('calculateCacheRate', () => {
  it('按输入与缓存读取计算命中率', () => {
    expect(calculateCacheRate(200, 800)).toBe(80)
    expect(calculateCacheRate(0, 1000)).toBe(100)
    expect(calculateCacheRate(1000, 0)).toBe(0)
  })

  it('无输入或无效数据时返回 null', () => {
    expect(calculateCacheRate(0, 0)).toBeNull()
    expect(calculateCacheRate(undefined, undefined)).toBeNull()
  })
})

describe('calculateContextCapacity', () => {
  it('计算已用、上限与占用百分比和状态等级', () => {
    const pressure: ContextPressureProjection = {
      pressureTokens: 121055,
      contextWindow: 500000
    }
    const cap = calculateContextCapacity(pressure)
    expect(cap).toEqual({
      usedTokens: 121055,
      contextWindow: 500000,
      remainingTokens: 378945,
      usedPercent: 24,
      level: 'comfortable'
    })
  })

  it('超过 75% 预警，超过 90% 危险', () => {
    expect(calculateContextCapacity({ pressureTokens: 380000, contextWindow: 500000 })?.level).toBe('warning')
    expect(calculateContextCapacity({ pressureTokens: 460000, contextWindow: 500000 })?.level).toBe('critical')
  })
})

describe('deriveComposerStats', () => {
  it('汇总底部栏平铺所需数据', () => {
    const stats: SessionStatsProjection = {
      decodeTokens: 1000,
      llmMs: 20000,
      ttftMs: 15000,
      decodeMs: 5000
    }
    const usage: TokenUsageProjection = {
      totals: {
        uncachedInputTokens: 2000,
        cacheReadTokens: 8000,
        outputTokens: 1000
      }
    }
    const pressure: ContextPressureProjection = {
      pressureTokens: 50000,
      contextWindow: 200000
    }

    const res = deriveComposerStats(stats, usage, pressure, 4200)
    expect(res).toMatchObject({
      context: {
        label: '50k / 200k (25%)',
        level: 'comfortable'
      },
      tps: {
        value: 50,
        label: '50 t/s'
      },
      cache: {
        percent: 80,
        label: '缓存 80%',
        bucket: 'good'
      },
      duration: {
        ms: 4200,
        label: '4.2 秒'
      }
    })
  })
})
