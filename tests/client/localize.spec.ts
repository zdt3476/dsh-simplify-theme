import { describe, expect, it } from 'vitest'
import { effortName, providerName } from '../../src/client/localize'

describe('localized enumerations', () => {
  it('英文档位 id 换成中文，宿主中文名原样保留', () => {
    expect(effortName('low', 'low')).toBe('低')
    expect(effortName('high', undefined)).toBe('高')
    expect(effortName('xhigh', 'Extra High')).toBe('Extra High')
    expect(effortName('low', '低')).toBe('低')
    expect(effortName('custom', undefined)).toBe('custom')
    expect(effortName(undefined, undefined)).toBe('')
  })

  it('内置 DeepSeek 供应商用中文名，其它保持原文', () => {
    expect(providerName('deepseek-official', 'DeepSeek')).toBe('DeepSeek 官方')
    expect(providerName('deepseek-account', 'deepseek-account')).toBe('DeepSeek 账号')
    expect(providerName('openai', 'OpenAI')).toBe('OpenAI')
    expect(providerName('deepseek-official', 'DeepSeek 内部')).toBe('DeepSeek 内部')
  })
})
