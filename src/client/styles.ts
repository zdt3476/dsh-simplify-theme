/**
 * dock 控件与侧栏 tabs 的样式。
 *
 * 隐藏原生 model / permission seat 用 `:has()` 门控：只有当 composer seat 里
 * 真的渲染了本插件的 dock 控件时才隐藏。这样 hero（新会话）态、插件被禁用、
 * dock 未渲染时原生控件自动恢复，不残留死白区域。
 */

export const UI_CSS = `
/* —— dock 控件行：接管 model 与 permission —— */
/* slot anchor 自带 display:contents 内联样式，规则要打在条目组件根上 */
[data-composer-seat]:has([data-dsh-simplify-dock]) [data-slot="conversation.input.model"] > *,
[data-composer-seat]:has([data-dsh-simplify-dock]) [data-slot="conversation.input.permission"] > * {
  display: none;
}

[data-dsh-simplify-dock] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  flex: 1 1 100%;
}

/* dock 行对齐聊天卡片：复用卡片自身的宽度约束，权限/模型贴卡片左右缘 */
[data-composer-dock]:has([data-dsh-simplify-dock]) {
  box-sizing: border-box;
  width: calc(100% - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  max-width: calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  margin-left: auto;
  margin-right: auto;
  position: relative;
}

[data-composer-dock]:has([data-dsh-simplify-dock]) > :not([data-dsh-simplify-dock]):not([data-slot]) {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
}

[data-composer-dock]:has([data-dsh-simplify-dock]) > [data-slot='conversation.composer.dock'] > :not([data-dsh-simplify-dock]) {
  display: none;
}

[data-dsh-simplify-dock-left],
[data-dsh-simplify-dock-right] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

[data-dsh-simplify-pill] {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 6px;
  border-radius: var(--dsw-radius-sm);
  font-size: 12px;
  line-height: 16px;
  min-width: 0;
  max-width: 260px;
}

[data-dsh-simplify-pill]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}

[data-dsh-simplify-pill]:disabled {
  color: var(--dsw-alias-label-dimmed);
  cursor: default;
}

[data-dsh-simplify-pill-label] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-dsh-simplify-pill-caption] {
  color: var(--dsw-alias-label-caption);
  flex: none;
}

[data-dsh-simplify-caret] {
  flex: none;
  color: var(--dsw-alias-label-caption);
  font-size: 10px;
  transition: transform 0.12s ease;
}

[data-dsh-simplify-pill][aria-expanded='true'] [data-dsh-simplify-caret] {
  transform: rotate(180deg);
}

/* —— 弹层 —— */
[data-dsh-simplify-popup] {
  position: fixed;
  z-index: 1100;
  min-width: 200px;
  max-width: min(320px, 100vw - 32px);
  max-height: min(360px, 100vh - 96px);
  overflow: auto;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  box-shadow: var(--dsw-elevation-panel);
  color: var(--dsw-alias-label-primary);
  padding: 4px;
  font-size: 13px;
  line-height: 20px;
}

/* 模型平铺面板：一供应商一列 */
[data-dsh-simplify-model-grid] {
  display: flex;
  align-items: stretch;
  gap: 8px;
  min-width: 320px;
  max-width: min(90vw, 960px);
  max-height: min(480px, 100vh - 96px);
  padding: 8px;
}

[data-dsh-simplify-column] {
  display: flex;
  flex-direction: column;
  min-width: 180px;
  max-width: 240px;
  flex: 1 1 0;
}

[data-dsh-simplify-column] [data-dsh-simplify-group] {
  position: static;
  margin-bottom: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
}

[data-dsh-simplify-column-body] {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  min-height: 0;
}

[data-dsh-simplify-model-grid] [data-dsh-simplify-item] {
  padding: 7px 10px;
  border-radius: var(--dsw-radius-sm);
  min-height: 32px;
}

[data-dsh-simplify-model-grid] [data-dsh-simplify-item]:hover,
[data-dsh-simplify-model-grid] [data-dsh-simplify-item][data-active='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
}

[data-dsh-simplify-column] + [data-dsh-simplify-column] {
  border-left: 1px solid var(--dsw-alias-border-l1);
  padding-left: 8px;
}

[data-dsh-simplify-popup] [data-dsh-simplify-group] {
  padding: 6px 8px 2px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
  position: sticky;
  top: 0;
  background: var(--dsw-alias-bg-layer-2);
  z-index: 1;
}

[data-dsh-simplify-popup] button[data-dsh-simplify-item] {
  appearance: none;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 5px 8px;
  border-radius: var(--dsw-radius-sm);
  font: inherit;
}

[data-dsh-simplify-popup] button[data-dsh-simplify-item]:hover,
[data-dsh-simplify-popup] button[data-dsh-simplify-item][data-active='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
}

[data-dsh-simplify-popup] [data-dsh-simplify-item-detail] {
  display: block;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

[data-dsh-simplify-popup] [data-dsh-simplify-badge] {
  flex: none;
  font-size: 10px;
  padding: 0 4px;
  border-radius: var(--dsw-radius-xs);
  background: var(--dsw-alias-interactive-bg-active);
  color: var(--dsw-alias-label-secondary);
}

[data-dsh-simplify-popup] [data-dsh-simplify-note] {
  padding: 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}

[data-dsh-simplify-popup] [data-dsh-simplify-error] {
  color: var(--dsw-alias-state-error-primary);
}

/* —— 思考等级滑块 —— */
[data-dsh-simplify-effort] {
  padding: 8px 10px 6px;
  min-width: 220px;
}

[data-dsh-simplify-effort-title] {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
  margin-bottom: 6px;
}

[data-dsh-simplify-effort-slider] {
  width: 100%;
  accent-color: var(--dsw-alias-state-business-primary);
  margin: 0;
}

[data-dsh-simplify-effort-scale] {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--dsw-alias-label-caption);
  margin-top: 2px;
}

/* —— 侧栏归档 tabs —— */
[data-dsh-simplify-tabs] {
  display: flex;
  align-items: stretch;
  gap: 2px;
  padding: 0 8px 4px;
}

[data-dsh-simplify-tabs][hidden] {
  display: none;
}

[data-dsh-simplify-tab] {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font-size: 12px;
  line-height: 18px;
  padding: 3px 8px;
  border-radius: var(--dsw-radius-sm);
  position: relative;
}

[data-dsh-simplify-tab]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

[data-dsh-simplify-tab][data-active='true'] {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}

[data-dsh-simplify-tab][data-active='true']::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 0;
  height: 2px;
  border-radius: 1px;
  background: var(--dsw-alias-state-business-primary);
}

[data-sidebar-collapsed] [data-dsh-simplify-tabs] {
  display: none;
}

/* —— 工作区列表降噪 —— */
[data-slot='sidebar.workspaces'] [data-row-key] {
  padding-top: 2px;
  padding-bottom: 2px;
}

[data-slot='sidebar.workspaces'] [data-row-key^='workspace:'] svg[class*='arrow'] {
  opacity: 0.55;
}

[data-slot='sidebar.workspaces'] [data-row-key^='workspace:']:hover svg[class*='arrow'] {
  opacity: 1;
}

[data-dsh-simplify-filter-host] {
  display: flex;
  min-width: 0;
  flex: 1;
}

[data-dsh-simplify-filter] {
  appearance: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  min-width: 0;
  width: 100%;
  padding: 2px 0;
}

[data-dsh-simplify-filter]::placeholder {
  color: var(--dsw-alias-label-caption);
}

[data-dsh-simplify-filter]:focus-visible {
  box-shadow: inset 0 -1px 0 var(--dsw-alias-state-business-primary);
}
`
