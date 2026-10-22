/**
 * dock 根控件：把模型、思考等级、权限三颗控件放进 `conversation.composer.dock`。
 *
 * dock 是 list slot，只在会话态渲染——正好满足「与上下文信息同一行」。
 * 新会话 hero 态保持原生控件（`:has()` 门控的隐藏规则不会生效）。
 */

import type { ModelDirectories } from './model-directory'
import { createModelControl } from './model-control'
import { createPermissionControl } from './permission-control'
import type { DockShared, H, ReactHooks } from './dock-shared'

export interface DockHostProps {
  sessionId: string
  directories: ModelDirectories
  remote: { permissionPresets: { catalog: () => Promise<{ ok: boolean; value?: import('./permission-catalog').PermissionCatalog; error?: { code: string; message: string } }> } }
  useProjection: (key: 'permissions') => { currentValue: string } | undefined
  session: () => import('./permission-control').PermissionSession | undefined
  shared: DockShared
}

export function createDockControl(props: DockHostProps) {
  const model = createModelControl({ sessionId: props.sessionId, directories: props.directories, shared: props.shared })
  const permission = createPermissionControl({
    sessionId: props.sessionId,
    remote: props.remote,
    useProjection: props.useProjection,
    session: props.session,
    shared: props.shared
  })
  const h = props.shared.h

  // 两个控件是独立组件：必须作为元素渲染（hooks 才有效），不能直接函数调用。
  return function DockControl() {
    return h('div', { 'data-dsh-simplify-dock': '' }, h(model as never, {}), h(permission as never, {}))
  }
}
