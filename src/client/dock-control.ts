/**
 * dock 根控件：把模型、思考等级、权限三颗控件排进 composer 的 dock 行。
 *
 * 两条渲染路径共用同一套控件：
 * - 会话态：DSH 的 `conversation.composer.dock` list slot 承载（slot 提供标准
 *   `useProjection` hook 读会话权限投影）。
 * - 新会话 hero 态：DSH 不渲染该 slot，由 hero-dock 注入容器承载，权限值改为
 *   轮询读取（见 hero-dock.ts）。
 *
 * 布局：模型组靠左、权限组靠右、统计项在中间聚簇（两侧 flex:1 等分）。
 */

import type { ModelDirectories } from './model-directory'
import { createModelControl } from './model-control'
import { createPermissionControl } from './permission-control'
import type { DockShared, H } from './dock-shared'

export interface DockHostProps {
  sessionId: string
  directories: ModelDirectories
  remote: { permissionPresets: { catalog: () => Promise<{ ok: boolean; value?: import('./permission-catalog').PermissionCatalog; error?: { code: string; message: string } }> } }
  useProjection: (key: 'permissions') => { currentValue: string } | undefined
  session: () => import('./permission-control').PermissionSession | undefined
  shared: DockShared
  usage?: () => import('./usage-rank').UsageRank
}

export function createDockControl(props: DockHostProps) {
  const model = createModelControl({ sessionId: props.sessionId, directories: props.directories, shared: props.shared, usage: props.usage })
  // 组件实例在工厂期创建一次：渲染期重建会丢弹层状态。
  const permission = createPermissionControl({
    sessionId: props.sessionId,
    remote: props.remote,
    session: props.session,
    shared: props.shared
  })
  const h = props.shared.h

  return function DockControl() {
    // slot 路径：标准 hook 读会话权限投影，作为 runtime 值下传。
    const projection = props.useProjection('permissions')
    return h('div', { 'data-dsh-simplify-dock': '' },
      h('div', { 'data-dsh-simplify-dock-left': '' }, h(model as never, {})),
      h('div', { 'data-dsh-simplify-dock-right': '' }, h(permission as never, { permissionValue: projection?.currentValue }))
    )
  }
}
