/**
 * 模型 + 思考等级 dock 控件。
 *
 * 触发行是两颗 pill：模型名（带供应商前缀）与思考等级，各自独立展开；
 * 思考等级用 range 滑块直接映射 adapter 宣告的 efforts，滑杆释放才提交，
 * 拖动过程只在本地预览。模型列表按供应商分组、带粘性组头，无内置搜索
 * ——分组后的层级已经可控，保留原生 `/model` 做搜索场景。
 */

import type { ModelDirectories, ModelSelection, CatalogGroup } from './model-directory'
import { effortLabel, displayName, orderGroups } from './model-directory'
import { placePopup, measurePopup } from './popup'
import { useDismiss } from './dock-shared'
import type { DockShared } from './dock-shared'

export interface ModelControlProps {
  sessionId: string
  directories: ModelDirectories
  shared: DockShared
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

    const groups: CatalogGroup[] = orderGroups(state.groups)
    const selection: ModelSelection | null = state.pending ?? state.current
    const name = displayName(groups, selection)
    const group = selection === null ? undefined : groups.find((candidate) => candidate.id === selection.provider)
    const providerPrefix = group === undefined ? '' : `${group.id === 'deepseek-account' ? t('provider.account') : group.name} / `
    const effort = effortLabel(groups, selection)
    const busy = state.status === 'selecting' || state.status === 'loading'

    const close = () => {
      setOpen('none')
      setDraftEffort(null)
    }

    // 弹层锚定 dock 行（与聊天卡片同宽）的右缘，而不是以按钮为中心：
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
      setPos(placePopup({ left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top }, size, { width: window.innerWidth, height: window.innerHeight }, 'right'))
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
      setOpen((prev) => (prev === 'model' ? 'none' : 'model'))
    }

    const pickModel = (provider: string, model: string, defaultEffort?: string) => {
      void directory.select({ provider, model, ...(defaultEffort === undefined ? {} : { reasoningEffort: defaultEffort }) })
      close()
    }

    const commitEffort = (value: string) => {
      if (state.current === null) return
      void directory.select({ provider: state.current.provider, model: state.current.model, reasoningEffort: value })
      close()
    }

    const pill = (kind: 'model' | 'effort', label: unknown, caption?: string) =>
      h('button', {
        type: 'button',
        'data-dsh-simplify-pill': '',
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
      }, label, caption === undefined ? null : h('span', { 'data-dsh-simplify-pill-caption': '' }, caption), h('span', { 'data-dsh-simplify-caret': '', 'aria-hidden': 'true' }, '▾'))

    const children: unknown[] = [
      pill('model', name === '' ? t('model.placeholder') : h('span', { 'data-dsh-simplify-pill-label': '' }, providerPrefix + name), effort === undefined ? undefined : undefined)
    ]

    if (effort !== undefined) {
      children.push(pill('effort', h('span', { 'data-dsh-simplify-pill-label': '' }, effort)))
    }

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
      for (const group of visibleGroups) {
        const models: unknown[] = []
        for (const model of group.models) {
          const active = selection !== null && selection.provider === group.id && selection.model === model.id
          models.push(
            h('button', {
              type: 'button',
              'data-dsh-simplify-item': '',
              'data-active': active ? 'true' : 'false',
              key: `m:${group.id}:${model.id}`,
              onClick: () => pickModel(group.id, model.id, model.reasoning?.defaultEffort)
            },
            h('span', { style: { flex: 1, minWidth: 0 } }, model.name),
            model.reasoning?.efforts !== undefined && model.reasoning.efforts.length > 1 ? h('span', { 'data-dsh-simplify-badge': '' }, String(model.reasoning.efforts.length)) : null,
            active ? '✓' : null
            )
          )
        }
        columns.push(
          h('div', { 'data-dsh-simplify-column': '', key: `g:${group.id}` },
            h('div', { 'data-dsh-simplify-group': '' }, group.id === 'deepseek-account' ? t('provider.account') : group.name),
            h('div', { 'data-dsh-simplify-column-body': '' }, models)
          )
        )
      }
      children.push(h('div', {
        'data-dsh-simplify-popup': '',
        'data-dsh-simplify-model-grid': '',
        ref: (el: HTMLElement | null) => { popupRef.current = el },
        style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top }
      }, columns))
    }

    // 思考等级滑块
    if (open === 'effort' && selection !== null) {
      const meta = groups.find((candidate) => candidate.id === selection.provider)?.models.find((candidate) => candidate.id === selection.model)?.reasoning
      const levels = meta?.efforts ?? []
      if (levels.length === 0) {
        children.push(h('div', { 'data-dsh-simplify-popup': '', ref: (el: HTMLElement | null) => { popupRef.current = el }, style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top } }, h('div', { 'data-dsh-simplify-note': '' }, t('effort.unavailable'))))
      } else {
        const currentId = draftEffort ?? selection.reasoningEffort ?? meta?.defaultEffort ?? levels[0]?.id
        const index = Math.max(0, levels.findIndex((level) => level.id === currentId))
        children.push(
          h('div', {
            'data-dsh-simplify-popup': '',
            'data-dsh-simplify-effort': '',
            ref: (el: HTMLElement | null) => { popupRef.current = el },
            style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top }
          },
          h('div', { 'data-dsh-simplify-effort-title': '' }, t('effort.title')),
          h('input', {
            type: 'range',
            'data-dsh-simplify-effort-slider': '',
            min: 0,
            max: levels.length - 1,
            step: 1,
            value: index,
            onChange: (event: Event) => {
              const input = event.target as HTMLInputElement
              setDraftEffort(levels[Number(input.value)]?.id ?? null)
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
          }),
          h('div', { 'data-dsh-simplify-effort-scale': '' }, levels.map((level) => h('span', { key: level.id }, level.name)))
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
