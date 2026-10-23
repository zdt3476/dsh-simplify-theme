import { describe, expect, it } from 'vitest'
import { effortLabel, effortLevels, displayName, orderGroups, providerColor, reasoningFor, retainEffort } from '../../src/client/model-directory'
import { computeHiddenRows, readRow } from '../../src/client/sidebar-filter'
import { tabLabels } from '../../src/client/sidebar-tabs'
import { placePopup } from '../../src/client/popup'
import { readArchivedFilter } from '../../src/client/view-state'
import { presetLabel, permissionRisk, CONFIRM_PRESETS } from '../../src/client/permission-catalog'
import { buildModelColumns } from '../../src/client/model-control'
import { hiddenCount, parsePinned, visibleGroupIds } from '../../src/client/sidebar-groups'
import { readCurrentSessionId, shouldInjectHeroDock } from '../../src/client/hero-dock'

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
    expect(effortLabel([{ id: 'p', name: 'P', models: [{ id: 'm', name: 'M', reasoning: { efforts: [{ id: 'high', name: '高' }] } }] }], { provider: 'p', model: 'm' })).toBe('默认')
    expect(effortLabel(groups, { provider: 'deepseek-official', model: 'deepseek-flash' })).toBeUndefined()
    expect(effortLabel(groups, { provider: 'openai', model: 'gpt-5' })).toBe('高')
    expect(reasoningFor(groups, { provider: 'none', model: 'x' })).toBeUndefined()
    expect(displayName(groups, null)).toBe('')
  })

  it('滑块保留供应商默认档位，不擅自采用第一档', () => {
    const levels = [{ id: 'low', name: '低' }, { id: 'high', name: '高' }]
    expect(effortLevels({ efforts: levels }, '默认')).toEqual([{ name: '默认' }, ...levels])
    expect(effortLevels({ efforts: levels, defaultEffort: 'high' }, '默认')).toEqual(levels)
    expect(effortLevels(undefined, '默认')).toEqual([])
    expect(effortLevels({ efforts: [] }, '默认')).toEqual([])
    expect(effortLabel([], { provider: 'x', model: 'm' }, '默认', 'high')).toBe('高')
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
  it('默认以锚点为中心水平居中', () => {
    const placement = placePopup({ left: 100, right: 200, bottom: 300, top: 280 }, { width: 240, height: 200 }, viewport)
    expect(placement).toEqual({ left: 30, top: 304 })
  })

  it('越界时钳制在视口内', () => {
    const overflowRight = placePopup({ left: 1300, right: 1400, bottom: 300, top: 280 }, { width: 240, height: 200 }, viewport)
    expect(overflowRight.left).toBe(1440 - 8 - 240)
    const overflowLeft = placePopup({ left: 10, right: 30, bottom: 300, top: 280 }, { width: 240, height: 200 }, viewport)
    expect(overflowLeft.left).toBe(8)
  })

  it('left / right 对齐分支保持可用', () => {
    const left = placePopup({ left: 100, right: 200, bottom: 300, top: 280 }, { width: 240, height: 200 }, viewport, 'left')
    expect(left).toEqual({ left: 100, top: 304 })
    const right = placePopup({ left: 100, right: 200, bottom: 300, top: 280 }, { width: 240, height: 200 }, viewport, 'right')
    expect(right).toEqual({ left: 8, top: 304 })
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
    expect(presetLabel('auto', 'auto', { ...labels, 'permission.auto': '自动审查' })).toBe('自动审查')
  })

  it('权限风险等级用于着色', () => {
    expect(permissionRisk('read-only')).toBe('safe')
    expect(permissionRisk('workspace-write')).toBe('normal')
    expect(permissionRisk('danger-full-access')).toBe('danger')
    expect(permissionRisk('auto')).toBe('experimental')
    expect(permissionRisk('host-custom')).toBe('normal')
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

describe('sidebar groups', () => {
  const groups = [
    { id: 'a', pinned: false },
    { id: 'b', pinned: false },
    { id: 'c', pinned: false },
    { id: 'd', pinned: false },
    { id: 'e', pinned: false },
    { id: 'f', pinned: false },
    { id: 'deep', pinned: true }
  ]

  it('只保留前 N 个非置顶组，置顶组始终可见', () => {
    const visible = visibleGroupIds(groups, 3)
    expect([...visible].sort()).toEqual(['a', 'b', 'c', 'deep'])
    expect(hiddenCount(groups, 3)).toBe(3)
  })

  it('置顶不占用普通组额度', () => {
    const visible = visibleGroupIds(groups, 5)
    expect(visible.has('deep')).toBe(true)
    expect(visible.size).toBe(6)
    expect(hiddenCount(groups, 5)).toBe(1)
  })

  it('置顶列表解析容错', () => {
    expect(parsePinned('["a","b"]')).toEqual(['a', 'b'])
    expect(parsePinned('nope')).toEqual([])
    expect(parsePinned(null)).toEqual([])
    expect(parsePinned('[1,null,"x"]')).toEqual(['x'])
  })
})

describe('hero dock helpers', () => {
  it('仅在没有 slot、存在 dock 行时注入', () => {
    expect(shouldInjectHeroDock({ hasRow: true, hasSlot: false, hasHost: false })).toBe(true)
    expect(shouldInjectHeroDock({ hasRow: true, hasSlot: true, hasHost: false })).toBe(false)
    expect(shouldInjectHeroDock({ hasRow: true, hasSlot: false, hasHost: true })).toBe(false)
    expect(shouldInjectHeroDock({ hasRow: false, hasSlot: false, hasHost: false })).toBe(false)
  })

  it('当前会话 id 解析容错', () => {
    expect(readCurrentSessionId('{"sessionId":"session-1"}')).toBe('session-1')
    expect(readCurrentSessionId('{"sessionId":""}')).toBeUndefined()
    expect(readCurrentSessionId('{}')).toBeUndefined()
    expect(readCurrentSessionId('bad')).toBeUndefined()
    expect(readCurrentSessionId(null)).toBeUndefined()
  })
})

describe('provider colors', () => {
  it('同一供应商稳定取色，不同供应商分散', () => {
    const a = providerColor('deepseek-official')
    expect(providerColor('deepseek-official')).toBe(a)
    const colors = new Set(['deepseek-official', 'deepseek-account', 'openai', 'anthropic'].map(providerColor))
    expect(colors.size).toBeGreaterThan(1)
  })
})

describe('effort retention across model switch', () => {
  const meta = (efforts: string[], defaultEffort?: string) => ({ defaultEffort, efforts: efforts.map((id) => ({ id, name: id })) })

  it('目标模型支持原档位时保留，否则回落到它的默认档位', () => {
    expect(retainEffort(meta(['low', 'high']), 'high')).toBe('high')
    expect(retainEffort(meta(['low', 'high'], 'low'), 'high')).toBe('high')
    expect(retainEffort(meta(['low', 'medium'], 'medium'), 'high')).toBe('medium')
    expect(retainEffort(undefined, 'high')).toBeUndefined()
    expect(retainEffort(meta(['low'], 'low'), undefined)).toBe('low')
  })
})
