import { describe, expect, it } from 'vitest'
import { classifyPercent, readPercent } from '../../src/client/stat-colors'
import { withFallback } from '../../src/client/locale-fallback'

describe('percent coloring', () => {
  it('从文案中取百分比', () => {
    expect(readPercent('缓存命中 95%')).toBe(95)
    expect(readPercent('20%')).toBe(20)
    expect(readPercent('12 轮 3 步')).toBeNull()
    expect(readPercent('')).toBeNull()
  })

  it('缓存命中越高越好，上下文占用越高越危险', () => {
    expect(classifyPercent('cache', 95)).toBe('good')
    expect(classifyPercent('cache', 60)).toBe('warn')
    expect(classifyPercent('cache', 20)).toBe('bad')
    expect(classifyPercent('context', 20)).toBe('good')
    expect(classifyPercent('context', 70)).toBe('warn')
    expect(classifyPercent('context', 95)).toBe('bad')
  })
})

describe('locale fallback', () => {
  const dict = { 'filter.placeholder': '筛选…', 'groups.more': '还有 {count} 个工作区' }

  it('宿主解析成功时原样返回', () => {
    const t = withFallback((key) => `host:${key}`, dict)
    expect(t('filter.placeholder')).toBe('host:filter.placeholder')
  })

  it('宿主返回键名时用内置文案并支持插值', () => {
    const t = withFallback((key) => key, dict)
    expect(t('filter.placeholder')).toBe('筛选…')
    expect(t('groups.more', { count: 3 })).toBe('还有 3 个工作区')
  })

  it('内置字典也没有时返回原值', () => {
    const t = withFallback((key) => key, dict)
    expect(t('unknown.key')).toBe('unknown.key')
  })
})
