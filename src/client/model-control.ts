/**
 * 模型 + 思考等级 dock 控件。
 *
 * 触发行是两颗 pill：模型名（带供应商前缀）与思考等级，各自独立展开；
 * 思考等级用 range 滑块直接映射 adapter 宣告的 efforts，滑杆释放才提交，
 * 拖动过程只在本地预览。模型列表按供应商分组、带粘性组头，无内置搜索
 * ——分组后的层级已经可控，保留原生 `/model` 做搜索场景。
 */

import type { ModelDirectories, ModelSelection, CatalogGroup } from './model-directory'
import { effortLabel, effortLevels, displayName, orderGroups, providerColor, retainEffort } from './model-directory'
import { rankCatalog, type UsageRank } from './usage-rank'
import { effortName, providerName } from './localize'
import { placePopup, measurePopup } from './popup'
import { useDismiss } from './dock-shared'
import type { DockShared } from './dock-shared'

export interface ModelControlProps {
  sessionId: string
  directories: ModelDirectories
  shared: DockShared
  /** 打开面板时读取一次用量聚合，用于按使用频率排序。 */
  usage?: () => UsageRank
  /** 选择模型后记录一次本地使用，用于清理历史后仍保留排序。 */
  recordSelection?: (provider: string, model: string) => void
}

export function createModelControl(props: ModelControlProps) {
  const { h, hooks, t } = props.shared
  const sh = props.shared
  const directory = props.directories.directoryFor(props.sessionId)

  return function ModelControl() {
    const state = hooks.useSyncExternalStore(
      (fn) => directory.store.subscribe(fn),
      () => directory.store.getSnapshot()
    )
    // 挂载即拉目录：思考等级 pill 与供应商分组不依赖用户先点开弹层。
    hooks.useEffect(() => {
      directory.load().catch(() => {})
    }, [])
    const [open, setOpen] = hooks.useState<'none' | 'model' | 'effort'>('none')
    const [draftEffort, setDraftEffort] = hooks.useState<string | null>(null)
    const triggerRef = hooks.useRef<HTMLElement | null>(null)
    const popupRef = hooks.useRef<HTMLElement | null>(null)
    const [pos, setPos] = hooks.useState<{ left: number; top: number } | null>(null)

    const baseGroups: CatalogGroup[] = orderGroups(state.groups)
    // 面板打开时才聚合用量（避免每次渲染都扫全量会话），目录展示顺序按真实使用频率。
    const [usageRank, setUsageRank] = hooks.useState<UsageRank | null>(null)
    const groups: CatalogGroup[] = usageRank === null ? baseGroups : rankCatalog(baseGroups, usageRank)
    const selection: ModelSelection | null = state.pending ?? state.current
    const name = displayName(groups, selection)
    const group = selection === null ? undefined : groups.find((candidate) => candidate.id === selection.provider)
    // 供应商前缀只在同名模型跨供应商重名时才需要；否则让模型名独占空间，长名字更可读。
    const duplicatedName = groups.filter((candidate) => candidate.models.some((model) => model.name === name)).length > 1
    const providerLabel = group === undefined ? '' : providerName(group.id, group.name)
    const modelLabel = name === '' ? t('model.placeholder') : duplicatedName ? `${providerLabel} / ${name}` : name
    const effort = effortLabel(groups, selection, t('effort.providerDefault'), state.retainedEffort)
    const busy = state.status === 'selecting' || state.status === 'loading'

    const close = () => {
      setOpen('none')
      setDraftEffort(null)
    }

    // 弹层锚定 dock 行（与聊天卡片同宽）的左缘，与控件所在侧一致：
    // 宽面板不会因供应商多而溢出屏幕，位置也稳定可预期。
    hooks.useEffect(() => {
      if (open === 'none') {
        setPos(null)
        return
      }
      const row = triggerRef.current?.closest('[data-composer-dock]') as HTMLElement | null
      const anchor = row ?? triggerRef.current
      const popup = popupRef.current
      if (anchor === null || popup === null) return
      const rect = anchor.getBoundingClientRect()
      const size = measurePopup(popup)
      setPos(placePopup({ left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top }, size, { width: window.innerWidth, height: window.innerHeight }, 'left'))
    }, [open, state.groups.length])

    hooks.useEffect(() => {
      if (open === 'none') return
      const onResize = () => close()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [open])

    useDismiss(sh, close, open !== 'none')

    const openDirectory = () => {
      directory.load().catch(() => {})
      if (props.usage !== undefined) setUsageRank(props.usage())
      setOpen((prev) => (prev === 'model' ? 'none' : 'model'))
    }

    const pickModel = (provider: string, model: string, meta?: import('./model-directory').ReasoningMeta) => {
      // 换模型保留原思考档位；目标模型不支持该档位时用它自己的默认档位。
      const nextEffort = retainEffort(meta, selection?.reasoningEffort)
      props.recordSelection?.(provider, model)
      void directory.select({ provider, model, ...(nextEffort === undefined ? {} : { reasoningEffort: nextEffort }) })
      close()
    }

    const commitEffort = (value: string | undefined) => {
      if (selection === null) return
      void directory.select({ provider: selection.provider, model: selection.model, ...(value === undefined ? {} : { reasoningEffort: value }) })
      close()
    }

    const pill = (kind: 'model' | 'effort', label: unknown, color?: string) =>
      h('button', {
        type: 'button',
        'data-dsh-simplify-pill': '',
        'data-dsh-simplify-control': kind,
        'data-dsh-simplify-emphasis': kind,
        title: kind === 'model' && name !== '' ? `${providerLabel} / ${name}` : undefined,
        style: color === undefined ? undefined : { '--dsh-simplify-provider-color': color },
        'aria-label': kind === 'effort' ? `${t('effort.title')}：${effort ?? t('effort.unavailableShort')}` : undefined,
        'aria-haspopup': 'dialog',
        'aria-expanded': open === kind ? 'true' : 'false',
        disabled: busy,
        ref: (el: HTMLElement | null) => {
          if (kind === 'model') triggerRef.current = el
        },
        onClick: (event: Event) => {
          event.stopPropagation()
          if (kind === 'model') openDirectory()
          else setOpen((prev) => (prev === 'effort' ? 'none' : 'effort'))
        }
      },
      h('span', { 'data-dsh-simplify-pill-glyph': '', 'aria-hidden': 'true' }),
      label,
      h('span', { 'data-dsh-simplify-pill-caret': '', 'aria-hidden': 'true' }))

    // 供应商色按「有模型的供应商」在面板里的顺序取，保证同面板内不撞色。
    const orderedProviders = groups.filter((candidate) => candidate.models.length > 0)
    const providerIndex = group === undefined ? -1 : orderedProviders.findIndex((candidate) => candidate.id === group.id)
    const modelPill = pill('model', h('span', { 'data-dsh-simplify-pill-label': '' }, modelLabel), providerIndex < 0 || group === undefined ? undefined : providerColor(group.id, providerIndex))
    const children: unknown[] = [modelPill]

    children.push(h('span', { 'data-dsh-simplify-separator': '', 'aria-hidden': 'true' }, '·'))
    children.push(pill('effort', h('span', { 'data-dsh-simplify-pill-label': '' }, effort ?? t('effort.unavailableShort'))))

    // 模型列表：平铺放大——一供应商一列，列内模型纵向排列，全目录一屏可见。
    if (open === 'model') {
      const columns: unknown[] = []
      const visibleGroups = groups.filter((group) => group.models.length > 0)
      if (state.status === 'error' || state.error !== null) {
        columns.push(h('div', { 'data-dsh-simplify-note': '', 'data-dsh-simplify-error': '' }, state.error ?? t('error.load')))
      }
      if (visibleGroups.length === 0 && state.status !== 'loading') {
        columns.push(h('div', { 'data-dsh-simplify-note': '' }, t('model.empty')))
      }
      for (const [index, group] of visibleGroups.entries()) {
        const color = providerColor(group.id, index)
        const models: unknown[] = []
        for (const model of group.models) {
          const active = selection !== null && selection.provider === group.id && selection.model === model.id
          const effortCount = model.reasoning?.efforts?.length ?? 0
          models.push(
            h('button', {
              type: 'button',
              'data-dsh-simplify-item': '',
              'data-active': active ? 'true' : 'false',
              style: { '--dsh-simplify-provider-color': color },
              key: `m:${group.id}:${model.id}`,
              onClick: () => pickModel(group.id, model.id, model.reasoning)
            },
            h('span', { style: { flex: 1, minWidth: 0 } }, model.name),
            effortCount > 1 ? h('span', { 'data-dsh-simplify-badge': '' }, String(effortCount)) : null,
            active ? h('span', { 'data-dsh-simplify-check': '', 'aria-hidden': 'true' }, '✓') : null
            )
          )
        }
        columns.push(
          h('div', { 'data-dsh-simplify-column': '', key: `g:${group.id}`, style: { '--dsh-simplify-provider-color': color } },
            h('div', { 'data-dsh-simplify-group': '' },
              h('span', { 'data-dsh-simplify-provider-dot': '', 'aria-hidden': 'true' }),
              h('span', { 'data-dsh-simplify-provider-name': '' }, providerName(group.id, group.name))
            ),
            h('div', { 'data-dsh-simplify-column-body': '' }, models)
          )
        )
      }
      children.push(h('div', {
        'data-dsh-simplify-popup': '',
        'data-dsh-simplify-model-grid': '',
        ref: (el: HTMLElement | null) => { popupRef.current = el },
        style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top }
      },
      h('div', { 'data-dsh-simplify-grid-head': '' },
        h('span', { 'data-dsh-simplify-grid-title': '' }, t('model.title')),
        visibleGroups.length === 0 ? null : h('span', { 'data-dsh-simplify-grid-hint': '' }, t('model.providers', { count: visibleGroups.length }))
      ),
      h('div', { 'data-dsh-simplify-grid-columns': '' }, columns)))
    }

    // 思考等级滑块：标题行给出当前档位，轨道带填充进度，刻度文字标出全部档位。
    if (open === 'effort') {
      const meta = groups.find((candidate) => candidate.id === selection?.provider)?.models.find((candidate) => candidate.id === selection?.model)?.reasoning
      const levels = effortLevels(meta, t('effort.providerDefault'))
      if (levels.length === 0) {
        children.push(h('div', { 'data-dsh-simplify-popup': '', ref: (el: HTMLElement | null) => { popupRef.current = el }, style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top } }, h('div', { 'data-dsh-simplify-note': '' }, t('effort.unavailable'))))
      } else {
        const currentId = draftEffort === null ? selection?.reasoningEffort ?? meta?.defaultEffort : draftEffort || undefined
        const draftIndex = draftEffort === null ? -1 : levels.findIndex((level) => (level.id ?? '') === draftEffort)
        const index = draftIndex >= 0 ? draftIndex : Math.max(0, levels.findIndex((level) => level.id === currentId))
        const fill = levels.length > 1 ? (index / (levels.length - 1)) * 100 : 100
        children.push(
          h('div', {
            'data-dsh-simplify-popup': '',
            'data-dsh-simplify-effort': '',
            ref: (el: HTMLElement | null) => { popupRef.current = el },
            style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top }
          },
          h('div', { 'data-dsh-simplify-effort-head': '' },
            h('span', { 'data-dsh-simplify-effort-title': '' }, t('effort.title')),
            h('span', { 'data-dsh-simplify-effort-value': '' }, levels[index]?.name ?? '')
          ),
          h('div', { 'data-dsh-simplify-effort-rail': '', style: { '--dsh-simplify-fill': `${fill}%` } },
            h('input', {
              type: 'range',
              'aria-label': t('effort.title'),
              'aria-valuetext': levels[index]?.name,
              'data-dsh-simplify-effort-slider': '',
              min: 0,
              max: levels.length - 1,
              step: 1,
              value: index,
              onChange: (event: Event) => {
                const input = event.target as HTMLInputElement
                setDraftEffort(levels[Number(input.value)]?.id ?? '')
              },
              onPointerUp: (event: Event) => {
                const level = levels[Number((event.target as HTMLInputElement).value)]
                if (level !== undefined) commitEffort(level.id)
              },
              onKeyUp: (event: KeyboardEvent) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
                  const input = event.target as HTMLInputElement
                  const level = levels[Number(input.value)]
                  if (level !== undefined) commitEffort(level.id)
                }
              }
            })
          ),
          h('div', { 'data-dsh-simplify-effort-scale': '' }, levels.map((level, levelIndex) => {
            const ratio = levels.length > 1 ? levelIndex / (levels.length - 1) : 0
            return h('span', {
              key: level.id ?? 'provider-default',
              'data-active': levelIndex === index ? 'true' : 'false',
              // 标签中心对准档位位置（含两端），与滑块拇指轨迹重合。
              style: { left: `${ratio * 100}%`, transform: 'translateX(-50%)' }
            }, level.name)
          }))
          )
        )
      }
    }

    return h('div', { 'data-dsh-simplify-dock-root': '' }, children)
  }
}

export interface ColumnBuildInput {
  groups: readonly { id: string; name: string; models: readonly { id: string; name: string; reasoning?: { defaultEffort?: string; efforts?: readonly { id: string; name: string }[] } }[] }[]
  selection: { provider: string; model: string } | null
  accountLabel: string
}

/**
 * 平铺网格的列数据：一供应商一列；返回列头与列内条目 id 列表（展示名）。
 * 独立成纯函数供单测；组件侧只负责把它渲染成 DOM。
 */
export function buildModelColumns(input: ColumnBuildInput): Array<{ id: string; label: string; models: Array<{ id: string; name: string; active: boolean; effortCount: number }> }> {
  return input.groups
    .filter((group) => group.models.length > 0)
    .map((group) => ({
      id: group.id,
      label: group.id === 'deepseek-account' ? input.accountLabel : group.name,
      models: group.models.map((model) => ({
        id: model.id,
        name: model.name,
        active: input.selection !== null && input.selection.provider === group.id && input.selection.model === model.id,
        effortCount: model.reasoning?.efforts?.length ?? 0
      }))
    }))
}
