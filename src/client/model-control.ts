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
    const [open, setOpen] = hooks.useState<'none' | 'model' | 'effort'>('none')
    const [draftEffort, setDraftEffort] = hooks.useState<string | null>(null)
    const triggerRef = hooks.useRef<HTMLElement | null>(null)
    const popupRef = hooks.useRef<HTMLElement | null>(null)
    const [pos, setPos] = hooks.useState<{ left: number; top: number } | null>(null)

    const groups: CatalogGroup[] = orderGroups(state.groups)
    const selection: ModelSelection | null = state.pending ?? state.current
    const name = displayName(groups, selection)
    const group = selection === null ? undefined : groups.find((candidate) => candidate.id === selection.provider)
    const providerPrefix = group === undefined ? '' : `${group.id === 'deepseek-account' ? t('provider.account') : group.name} · `
    const effort = effortLabel(groups, selection)
    const busy = state.status === 'selecting' || state.status === 'loading'

    const close = () => {
      setOpen('none')
      setDraftEffort(null)
    }

    // 弹层定位：打开后测量实际尺寸再落位；窗口变化时收起。
    hooks.useEffect(() => {
      if (open === 'none') {
        setPos(null)
        return
      }
      const trigger = triggerRef.current
      const popup = popupRef.current
      if (trigger === null || popup === null) return
      const rect = trigger.getBoundingClientRect()
      const size = measurePopup(popup)
      setPos(placePopup({ left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top }, size, { width: window.innerWidth, height: window.innerHeight }))
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

    // 模型列表
    if (open === 'model') {
      const rows: unknown[] = []
      if (state.status === 'error' || state.error !== null) {
        rows.push(h('div', { 'data-dsh-simplify-note': '', 'data-dsh-simplify-error': '' }, state.error ?? t('error.load')))
      }
      if (groups.length === 0 && state.status !== 'loading') {
        rows.push(h('div', { 'data-dsh-simplify-note': '' }, t('model.empty')))
      }
      for (const group of groups) {
        if (group.models.length === 0) continue
        rows.push(h('div', { 'data-dsh-simplify-group': '', key: `g:${group.id}` }, group.id === 'deepseek-account' ? t('provider.account') : group.name))
        for (const model of group.models) {
          const active = selection !== null && selection.provider === group.id && selection.model === model.id
          rows.push(
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
      }
      children.push(h('div', {
        'data-dsh-simplify-popup': '',
        ref: (el: HTMLElement | null) => { popupRef.current = el },
        style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top }
      }, rows))
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
            onPointerUp: () => {
              if (draftEffort !== null) commitEffort(draftEffort)
            },
            onKeyUp: (event: KeyboardEvent) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
                const input = event.target as HTMLInputElement
                setDraftEffort(levels[Number(input.value)]?.id ?? null)
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
