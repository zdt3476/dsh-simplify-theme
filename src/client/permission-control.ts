/**
 * 权限 dock 控件。
 *
 * 目录来自 `ctx.remote.permissionPresets.catalog()`，会话当前值来自
 * sessions 投影 `permissions.currentValue`。提交走 `session.command('/permission <preset>')`
 * ——与内置控件完全一致的通道。`danger-full-access` / `auto` 复刻内置的
 * 两步确认；其它预设直接提交。
 */

import { presetLabel, CONFIRM_PRESETS, type PermissionCatalog, type PermissionCatalogStore } from './permission-catalog'
import { useDismiss } from './dock-shared'
import { placePopup, measurePopup } from './popup'
import type { DockShared } from './dock-shared'

export interface PermissionSession {
  command: (line: string) => Promise<{ ok: boolean; value?: { matched?: unknown }; error?: { code: string; message: string } }>
}

export interface PermissionControlProps {
  sessionId: string
  remote: { permissionPresets: { catalog: () => Promise<{ ok: boolean; value?: PermissionCatalog; error?: { code: string; message: string } }> } }
  /** 会话级 permissions 投影 hook；值形如 { currentValue }。 */
  useProjection: (key: 'permissions') => { currentValue: string } | undefined
  session: () => PermissionSession | undefined
  shared: DockShared
}

export function createPermissionControl(props: PermissionControlProps) {
  const { h, hooks, t } = props.shared
  const sh = props.shared

  return function PermissionControl() {
    const projection = props.useProjection('permissions')
    const [open, setOpen] = hooks.useState(false)
    const [catalog, setCatalog] = hooks.useState<PermissionCatalog | null>(null)
    const [error, setError] = hooks.useState<string | null>(null)
    const [confirmPreset, setConfirmPreset] = hooks.useState<string | null>(null)
    const [busy, setBusy] = hooks.useState<string | null>(null)
    const triggerRef = hooks.useRef<HTMLElement | null>(null)
    const popupRef = hooks.useRef<HTMLElement | null>(null)
    const [pos, setPos] = hooks.useState<{ left: number; top: number } | null>(null)

    const close = () => {
      setOpen(false)
      setConfirmPreset(null)
    }

    const toggle = async () => {
      if (open) {
        close()
        return
      }
      setOpen(true)
      setError(null)
      if (catalog === null) {
        try {
          const result = await props.remote.permissionPresets.catalog()
          if (result.ok && result.value !== undefined) setCatalog(result.value)
          else setError(`${result.error?.code ?? 'error'}: ${result.error?.message ?? t('error.load')}`)
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : String(reason))
        }
      }
    }

    hooks.useEffect(() => {
      if (!open) {
        setPos(null)
        return
      }
      const trigger = triggerRef.current
      const popup = popupRef.current
      if (trigger === null || popup === null) return
      const rect = trigger.getBoundingClientRect()
      const size = measurePopup(popup)
      setPos(placePopup({ left: rect.left, right: rect.right, bottom: rect.bottom, top: rect.top }, size, { width: window.innerWidth, height: window.innerHeight }))
    }, [open, catalog])

    hooks.useEffect(() => {
      if (!open) return
      const onResize = () => close()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }, [open])

    useDismiss(sh, close, open)

    const submit = async (preset: string) => {
      setBusy(preset)
      try {
        const session = props.session()
        if (session === undefined) throw new Error(t('error.session'))
        const result = await session.command(`/permission ${preset}`)
        if (!result.ok) throw new Error(`${result.error?.code ?? 'error'}: ${result.error?.message ?? 'unknown'}`)
        close()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        setBusy(null)
      }
    }

    const pick = (preset: string) => {
      if (CONFIRM_PRESETS.has(preset)) {
        setConfirmPreset((prev) => (prev === preset ? null : preset))
        return
      }
      void submit(preset)
    }

    const current: string | undefined = projection?.currentValue
    const label = current === undefined ? null : presetLabel(current, current, {
      'permission.readOnly': t('permission.readOnly'),
      'permission.workspaceWrite': t('permission.workspaceWrite'),
      'permission.fullAccess': t('permission.fullAccess')
    })

    if (label === null) return null

    const rows: unknown[] = []
    if (catalog === null && error === null) rows.push(h('div', { 'data-dsh-simplify-note': '' }, t('permission.loading')))
    if (error !== null) rows.push(h('div', { 'data-dsh-simplify-note': '', 'data-dsh-simplify-error': '' }, error))
    for (const option of catalog?.options ?? []) {
      const active = option.value === current
      const name = presetLabel(option.value, option.name, {
        'permission.readOnly': t('permission.readOnly'),
        'permission.workspaceWrite': t('permission.workspaceWrite'),
        'permission.fullAccess': t('permission.fullAccess')
      })
      rows.push(
        h('button', {
          type: 'button',
          'data-dsh-simplify-item': '',
          'data-active': active ? 'true' : 'false',
          key: option.value,
          disabled: busy !== null,
          onClick: () => pick(option.value)
        },
        h('span', { style: { flex: 1, minWidth: 0 } }, name),
        option.value === 'auto' ? h('span', { 'data-dsh-simplify-badge': '' }, 'EXP') : null,
        active ? '✓' : null,
        option.description !== undefined ? h('span', { 'data-dsh-simplify-item-detail': '' }, option.description) : null
        )
      )
    }
    if (confirmPreset !== null) {
      rows.push(
        h('div', { 'data-dsh-simplify-note': '', key: 'confirm' },
          h('div', { style: { marginBottom: 6 } }, t('permission.confirmTitle')),
          h('button', {
            type: 'button',
            'data-dsh-simplify-item': '',
            onClick: () => { const target = confirmPreset; setConfirmPreset(null); void submit(target) }
          }, t('permission.confirmEnable')),
          h('button', { type: 'button', 'data-dsh-simplify-item': '', onClick: () => setConfirmPreset(null) }, t('permission.cancel'))
        )
      )
    }

    return h('div', { 'data-dsh-simplify-dock-root': '' },
      h('button', {
        type: 'button',
        'data-dsh-simplify-pill': '',
        'aria-expanded': open ? 'true' : 'false',
        ref: (el: HTMLElement | null) => { triggerRef.current = el },
        onClick: (event: Event) => { event.stopPropagation(); void toggle() }
      },
      h('span', { 'data-dsh-simplify-pill-label': '' }, label),
      h('span', { 'data-dsh-simplify-caret': '', 'aria-hidden': 'true' }, '▾')
      ),
      open ? h('div', {
        'data-dsh-simplify-popup': '',
        ref: (el: HTMLElement | null) => { popupRef.current = el },
        style: pos === null ? { visibility: 'hidden' } : { left: pos.left, top: pos.top }
      }, rows) : null
    )
  }
}
