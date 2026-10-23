import { describe, expect, it } from 'vitest'
import { effortLabel, displayName, orderGroups, reasoningFor } from '../../src/client/model-directory'
import { computeHiddenRows, readRow } from '../../src/client/sidebar-filter'
import { tabLabels } from '../../src/client/sidebar-tabs'
import { placePopup } from '../../src/client/popup'
import { readArchivedFilter } from '../../src/client/view-state'
import { presetLabel, CONFIRM_PRESETS } from '../../src/client/permission-catalog'
import { buildModelColumns } from '../../src/client/model-control'

describe('model directory helpers', () => {
  const groups = [
    { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5', name: 'GPT-5', reasoning: { defaultEffort: 'high', efforts: [{ id: 'low', name: '低' }, { id: 'medium', name: '中' }, { id: 'high', name: '高' }] } }] },
    { id: 'deepseek-official', name: 'DeepSeek', models: [{ id: 'deepseek-flash', name: 'DeepSeek Flash' }] },
    { id: 'deepseek-account', name: 'DeepSeek 账号', models: [{ id: 'sp', name: 'S 系' }] }
  ]

  it('供应商排序把账号/官方放前面', () => {
    const ordered = orderGroups(groups)
    expect(ordered.map((group) => group.id)).toEqual(['deepseek-account', 'deepseek-official', 'openai'])
  })

  it('展示名与思考等级标签', () => {
    const selection = { provider: 'openai', model: 'gpt-5', reasoningEffort: 'medium' }
    expect(displayName(groups, selection)).toBe('GPT-5')
    expect(effortLabel(groups, selection)).toBe('中')
    expect(effortLabel(groups, { provider: 'openai', model: 'gpt-5' })).toBe('高')
    expect(reasoningFor(groups, { provider: 'none', model: 'x' })).toBeUndefined()
    expect(displayName(groups, null)).toBe('')
  })

  it('目录丢失时展示名回落到模型 id', () => {
    expect(displayName(groups, { provider: 'x', model: 'deepseek-flash' })).toBe('deepseek-flash')
  })
})

describe('sidebar filter', () => {
  const rows = [
    { key: 'workspace:1', text: 'work 项目 alpha' },
    { key: 'session:a', text: '修复登录 bug' },
    { key: 'session:b', text: 'work 项目 alpha 的会话' },
    { key: 'workspace:2', text: 'personal' }
  ]

  it('空查询不隐藏任何行', () => {
    expect(computeHiddenRows(rows, '  ').size).toBe(0)
  })

  it('命中工作区时保留整组', () => {
    const hidden = computeHiddenRows(rows, 'work')
    expect(hidden.has('workspace:1')).toBe(false)
    expect(hidden.has('session:a')).toBe(true)
    expect(hidden.has('session:b')).toBe(false)
    expect(hidden.has('workspace:2')).toBe(true)
  })

  it('命中会话时保留其工作区，隐藏无关组', () => {
    const hidden = computeHiddenRows(rows, '登录')
    expect(hidden.has('workspace:1')).toBe(false)
    expect(hidden.has('session:a')).toBe(false)
    expect(hidden.has('workspace:2')).toBe(true)
  })

  it('readRow 读取 key 与小写文本', () => {
    const el = {
      getAttribute: (name: string) => (name === 'data-row-key' ? 'session:x' : null),
      textContent: 'Hello World'
    } as unknown as Element
    expect(readRow(el)).toEqual({ key: 'session:x', text: 'hello world' })
  })
})

describe('sidebar tabs', () => {
  it('tab 文案取自 locale 字典', () => {
    expect(tabLabels((key) => key)).toEqual({ sessions: 'tabs.sessions', archived: 'tabs.archived' })
  })
})

describe('popup placement', () => {
  const viewport = { width: 1440, height: 900 }
  it('默认挂在锚点下方并左对齐', () => {
    const placement = placePopup({ left: 100, right: 200, bottom: 300, top: 280 }, { width: 240, height: 200 }, viewport)
    expect(placement).toEqual({ left: 100, top: 304 })
  })

  it('右侧越界时右缘对齐并内收', () => {
    const placement = placePopup({ left: 1300, right: 1400, bottom: 300, top: 280 }, { width: 240, height: 200 }, viewport)
    expect(placement.left).toBe(1440 - 8 - 240)
  })

  it('下方放不下时翻转到锚点上方', () => {
    const placement = placePopup({ left: 100, right: 200, bottom: 880, top: 860 }, { width: 240, height: 200 }, viewport)
    expect(placement.top).toBe(860 - 200 - 4)
  })
})

describe('view state parsing', () => {
  it('合法值透传，非法回落 default', () => {
    expect(readArchivedFilter(JSON.stringify({ archivedFilter: 'only' }))).toBe('only')
    expect(readArchivedFilter(JSON.stringify({ archivedFilter: 'show' }))).toBe('show')
    expect(readArchivedFilter(JSON.stringify({ archivedFilter: 'bogus' }))).toBe('default')
    expect(readArchivedFilter(null)).toBe('default')
    expect(readArchivedFilter('not-json{')).toBe('default')
  })
})

describe('permission labels', () => {
  it('内置预设走本地化，未知名走 title-case', () => {
    const labels = { 'permission.readOnly': '仅可查看', 'permission.workspaceWrite': '工作区内修改', 'permission.fullAccess': '完全权限' }
    expect(presetLabel('read-only', 'read-only', labels)).toBe('仅可查看')
    expect(presetLabel('custom-preset', 'custom-preset', labels)).toBe('Custom Preset')
    expect(presetLabel('my-label', 'My Label', labels)).toBe('My Label')
  })

  it('高危预设集合包含完全权限与自动审查', () => {
    expect(CONFIRM_PRESETS.has('danger-full-access')).toBe(true)
    expect(CONFIRM_PRESETS.has('auto')).toBe(true)
  })
})

describe('model grid columns', () => {
  const groups = [
    { id: 'openai', name: 'OpenAI', models: [{ id: 'gpt-5', name: 'GPT-5', reasoning: { efforts: [{ id: 'low', name: '低' }, { id: 'high', name: '高' }] } }, { id: 'gpt-5-mini', name: 'GPT-5 mini' }] },
    { id: 'deepseek-account', name: 'DeepSeek 账号', models: [{ id: 'sp', name: 'S 系' }] },
    { id: 'empty', name: '空目录', models: [] }
  ]

  it('一供应商一列，空组剔除，账号组用本地化名', () => {
    const columns = buildModelColumns({ groups, selection: null, accountLabel: 'DeepSeek Account' })
    expect(columns.map((column) => column.id)).toEqual(['openai', 'deepseek-account'])
    expect(columns[1].label).toBe('DeepSeek Account')
    expect(columns[0].models).toHaveLength(2)
  })

  it('选中态与思考档位数标注', () => {
    const columns = buildModelColumns({ groups, selection: { provider: 'openai', model: 'gpt-5' }, accountLabel: 'A' })
    const gpt5 = columns[0].models[0]
    expect(gpt5.active).toBe(true)
    expect(gpt5.effortCount).toBe(2)
    expect(columns[0].models[1].active).toBe(false)
  })
})
