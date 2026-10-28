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

/* 摊平成行内项：权限组钉左、模型组钉右，中间统计项自然聚簇居中 */
[data-dsh-simplify-dock],
[data-dsh-simplify-hero-host] {
  display: contents;
}

/* dock 行与输入卡片等宽：宽度由 dock-align 读卡片实际宽度写进变量 */
[data-composer-dock]:has([data-dsh-simplify-dock]) {
  box-sizing: border-box;
  width: var(--dsh-simplify-card-width, calc(100% - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset)));
  max-width: none;
  margin-left: auto;
  margin-right: auto;
  /* 与输入卡片之间留出间距，不再紧贴卡片下缘 */
  margin-top: 3px;
  /* 宿主只在底部留 4px，补到与左右两侧一致的 16px（--dsh-composer-side-clearance） */
  margin-bottom: calc(var(--dsh-composer-side-clearance, 16px) - 4px);
  position: relative;
}

/* 隐藏原生底部统计胶囊与上下文环，由本插件的平铺状态栏接管 */
[data-composer-dock]:has([data-dsh-simplify-dock]) [data-composer-stat],
[data-composer-dock]:has([data-dsh-simplify-dock]) > span:has(> button > svg) {
  display: none !important;
}

[data-dsh-simplify-dock-left],
[data-dsh-simplify-dock-right] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* 控件与卡片圆角末梢对齐：内缩等于卡片圆角半径，视觉上从直边开始 */
[data-dsh-simplify-dock-left] { padding-left: var(--dsh-simplify-dock-inset-x, 20px); }
[data-dsh-simplify-dock-right] { padding-right: var(--dsh-simplify-dock-inset-x, 20px); }

/* 两侧等分：中间统计簇才能以卡片中心对齐（不等分时会被宽的一侧挤偏） */
[data-dsh-simplify-dock-left] {
  order: -1;
  flex: 1 1 0;
  justify-content: flex-start;
}

/* 中间平铺统计栏容器 */
[data-dsh-simplify-dock-center] {
  order: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  position: relative;
}

/* 平铺触发按钮：清晰字号 12.5px、内边距与微动效、等宽数字、居中对齐 */
.dsh-simplify-dock-stats-trigger {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #4b5563);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: var(--dsw-radius-md, 8px);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.dsh-simplify-dock-stats-trigger:hover,
.dsh-simplify-dock-stats-trigger[aria-expanded='true'] {
  background-color: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.05));
  border-color: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
  color: var(--dsw-alias-label-primary, #0f1115);
}

.dsh-simplify-stat-item {
  display: inline-flex;
  align-items: center;
}

.dsh-simplify-stat-sep {
  color: var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary, #9ca3af));
  opacity: 0.6;
  margin: 0 1px;
}

/* —— 结构化用量与性能看板浮层（Popover） —— */
.dsh-simplify-stats-popover {
  position: fixed;
  z-index: 1000;
  width: 380px;
  max-width: calc(100vw - 32px);
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2, #ffffff));
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
  border-radius: 14px;
  box-shadow:
    0 20px 48px -8px rgba(0, 0, 0, 0.28),
    0 0 0 1px var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06)),
    inset 0 1px 1px rgba(255, 255, 255, 0.15);
  color: var(--dsw-alias-label-primary, #0f1115);
  padding: 16px 18px;
  font-size: 12px;
  line-height: 18px;
  box-sizing: border-box;
  animation: dsh-stats-popover-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes dsh-stats-popover-in {
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.dsh-simplify-stats-popover-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
}

.dsh-simplify-stats-popover-title {
  display: inline-flex;
  align-items: center;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-primary, #0f1115);
}

.dsh-simplify-stats-popover-title::before {
  content: '';
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--dsw-alias-state-business-primary, #2563eb);
  box-shadow: 0 0 6px rgba(37, 99, 235, 0.6);
  margin-right: 8px;
  flex: none;
}

.dsh-simplify-stats-popover-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--dsw-alias-label-secondary, #4b5563);
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;
}

.dsh-simplify-stats-popover-badge[data-bucket='good'] {
  background: var(--dsw-alias-state-success-subtle, rgba(22, 163, 74, 0.12));
  color: var(--dsw-alias-state-success-primary, #16a34a);
  border-color: rgba(22, 163, 74, 0.2);
}

.dsh-simplify-stats-popover-badge[data-bucket='warn'] {
  background: var(--dsw-alias-state-warn-subtle, rgba(234, 179, 8, 0.15));
  color: var(--dsw-alias-state-warn-label, #b45309);
  border-color: rgba(234, 179, 8, 0.25);
}

.dsh-simplify-stats-popover-badge[data-bucket='bad'] {
  background: var(--dsw-alias-state-error-subtle, rgba(239, 68, 68, 0.15));
  color: var(--dsw-alias-state-error-primary, #dc2626);
  border-color: rgba(239, 68, 68, 0.25);
}

/* 进度条区块 */
.dsh-simplify-stats-section {
  margin-bottom: 14px;
}

.dsh-simplify-stats-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--dsw-alias-label-secondary, #4b5563);
}

.dsh-simplify-stats-progress-header strong {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #0f1115);
}

.dsh-simplify-stats-progress-track {
  display: flex;
  width: 100%;
  height: 6px;
  background: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
  border-radius: 999px;
  overflow: hidden;
  gap: 1px;
}

.dsh-simplify-stats-progress-fill {
  height: 100%;
  background: var(--dsw-alias-state-business-primary, #3b82f6);
  border-radius: 999px;
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.dsh-simplify-stats-progress-fill[data-bucket='good'] {
  background: var(--dsw-alias-state-success-primary, #16a34a);
}

.dsh-simplify-stats-progress-fill[data-bucket='warn'] {
  background: var(--dsw-alias-state-warn-label, #eab308);
}

.dsh-simplify-stats-progress-fill[data-bucket='bad'] {
  background: var(--dsw-alias-state-error-primary, #ef4444);
}

.dsh-simplify-stats-progress-fill.is-segment {
  border-radius: 1px;
  min-width: 2px;
}

.dsh-simplify-stats-progress-fill.is-system {
  background: #64748b;
}

.dsh-simplify-stats-progress-fill.is-tools {
  background: #8b5cf6;
}

.dsh-simplify-stats-progress-fill.is-messages {
  background: var(--dsw-alias-state-business-primary, #2563eb);
}

.dsh-simplify-stats-breakdown-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #6b7280);
}

.dsh-simplify-legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dsh-simplify-legend-chip::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  display: inline-block;
}

.dsh-simplify-legend-chip.is-system::before { background: #64748b; }
.dsh-simplify-legend-chip.is-tools::before { background: #8b5cf6; }
.dsh-simplify-legend-chip.is-messages::before { background: var(--dsw-alias-state-business-primary, #2563eb); }

.dsh-simplify-stats-progress-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #6b7280);
}

/* 2x2 指标卡片网格 */
.dsh-simplify-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 14px;
}

.dsh-simplify-stats-card {
  background: var(--dsw-alias-interactive-bg-subtle, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  border-radius: var(--dsw-radius-md, 10px);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  transition: all 0.15s ease;
}

.dsh-simplify-stats-card:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04));
  border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
}

.dsh-simplify-stats-card-k {
  font-size: 11px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, #6b7280);
  margin-bottom: 2px;
}

.dsh-simplify-stats-card-v {
  font-size: 16.5px;
  line-height: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, #0f1115);
  letter-spacing: -0.01em;
}

.dsh-simplify-stats-card-v.is-highlight {
  color: var(--dsw-alias-state-business-primary, #2563eb);
}

.dsh-simplify-stats-card-v[data-dsh-simplify-pct='good'] {
  color: var(--dsw-alias-state-success-primary, #16a34a);
}

.dsh-simplify-stats-card-v[data-dsh-simplify-pct='warn'] {
  color: var(--dsw-alias-state-warn-label, #b45309);
}

.dsh-simplify-stats-card-hint {
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  margin-top: 3px;
  line-height: 14px;
}

/* Token 明细列表 */
.dsh-simplify-stats-detail-list {
  background: var(--dsw-alias-interactive-bg-subtle, rgba(0, 0, 0, 0.02));
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  border-radius: var(--dsw-radius-md, 10px);
  padding: 8px 12px;
  margin-bottom: 12px;
}

.dsh-simplify-stats-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3.5px 0;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary, #4b5563);
}

.dsh-simplify-stats-detail-row strong {
  font-variant-numeric: tabular-nums;
  font-family: var(--dsw-font-family-code, ui-monospace, monospace);
  font-weight: 500;
  font-size: 11.5px;
  color: var(--dsw-alias-label-primary, #0f1115);
}

.dsh-simplify-stats-detail-row.is-total {
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
  margin-top: 4px;
  padding-top: 6px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #0f1115);
}

.dsh-simplify-stats-detail-row.is-total strong {
  font-weight: 700;
  color: var(--dsw-alias-label-primary, #0f1115);
}

/* 底部备注 */
.dsh-simplify-stats-footer {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #6b7280);
  padding-top: 8px;
  border-top: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
}

[data-dsh-simplify-dock-right] {
  order: 1;
  flex: 1 1 0;
  justify-content: flex-end;
}

/* 与 DSH 原生 seat 同规格：透明底、无描边，悬停/展开才出现浅灰底 */
[data-dsh-simplify-pill] {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  gap: 6px;
  height: 28px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-sm);
  font-size: 13px;
  line-height: 20px;
  min-width: 0;
  max-width: 260px;
}

[data-dsh-simplify-pill]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

/* 展开态用品牌色淡染，比 hover 更醒目但仍无描边（悬停时也保持淡染） */
[data-dsh-simplify-pill][aria-expanded='true'],
[data-dsh-simplify-pill][aria-expanded='true']:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsh-simplify-provider-color, var(--dsw-alias-state-business-primary)) 10%, transparent);
  color: var(--dsw-alias-label-primary);
}

[data-dsh-simplify-pill]:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
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

[data-dsh-simplify-pill-glyph] {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsh-simplify-provider-color, var(--dsw-alias-state-business-primary));
}

/* 权限按风险等级着色：只读=安全、工作区=常规、完全权限=危险、自动审查=实验 */
[data-dsh-simplify-control='permission'][data-dsh-simplify-risk='safe'] [data-dsh-simplify-pill-glyph] {
  background: var(--dsw-alias-state-success-primary);
}

[data-dsh-simplify-control='permission'][data-dsh-simplify-risk='danger'] {
  color: var(--dsw-alias-label-error);
}

[data-dsh-simplify-control='permission'][data-dsh-simplify-risk='danger'] [data-dsh-simplify-pill-glyph] {
  background: var(--dsw-alias-state-error-primary);
}



[data-dsh-simplify-control='permission'][data-dsh-simplify-risk='experimental'] [data-dsh-simplify-pill-glyph] {
  background: var(--dsw-alias-state-warn-primary);
}

[data-dsh-simplify-pill-caret] {
  flex: none;
  width: 0;
  height: 0;
  border-left: 3px solid transparent;
  border-right: 3px solid transparent;
  border-top: 4px solid var(--dsw-alias-label-caption);
  transition: transform 0.12s ease;
}

[data-dsh-simplify-pill][aria-expanded='true'] [data-dsh-simplify-pill-caret] {
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
  box-sizing: border-box;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  width: min(880px, calc(100vw - 32px));
  min-width: 0;
  max-width: calc(100vw - 32px);
  max-height: min(480px, 100vh - 96px);
}

[data-dsh-simplify-popup-head] {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px 6px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}

[data-dsh-simplify-grid-head] {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
}

[data-dsh-simplify-grid-title] {
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

[data-dsh-simplify-grid-hint] {
  font-size: 11px;
  color: var(--dsw-alias-label-caption);
}

[data-dsh-simplify-grid-columns] {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
  min-height: 0;
}

[data-dsh-simplify-column] {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: min(160px, 100%);
  max-width: 260px;
  flex: 1 1 170px;
}

[data-dsh-simplify-column] [data-dsh-simplify-group] {
  position: static;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 4px 8px;
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsh-simplify-provider-color) 10%, transparent);
  font-size: 12px;
  font-weight: 500;
}

[data-dsh-simplify-provider-dot] {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsh-simplify-provider-color);
}

[data-dsh-simplify-provider-name] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dsh-simplify-provider-color);
}

[data-dsh-simplify-column-body] {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  min-height: 0;
  max-height: min(320px, 50vh);
}

[data-dsh-simplify-model-grid] [data-dsh-simplify-item] {
  padding: 7px 10px;
  border-radius: var(--dsw-radius-sm);
  min-height: 32px;
}

[data-dsh-simplify-model-grid] [data-dsh-simplify-item]:hover {
  background: color-mix(in srgb, var(--dsh-simplify-provider-color) 8%, transparent);
}

[data-dsh-simplify-model-grid] [data-dsh-simplify-item][data-active='true'] {
  background: color-mix(in srgb, var(--dsh-simplify-provider-color) 14%, transparent);
  box-shadow: inset 2px 0 0 var(--dsh-simplify-provider-color);
  font-weight: 500;
}

[data-dsh-simplify-model-grid] [data-dsh-simplify-check] {
  flex: none;
  color: var(--dsh-simplify-provider-color);
  font-size: 12px;
}

[data-dsh-simplify-model-grid] [data-dsh-simplify-item] [data-dsh-simplify-badge] {
  background: color-mix(in srgb, var(--dsh-simplify-provider-color) 16%, transparent);
  color: var(--dsh-simplify-provider-color);
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

/* 弹层内的选中项：品牌色左侧条 + 品牌色勾选，与浅底 hover 区分 */
[data-dsh-simplify-popup] button[data-dsh-simplify-item][data-active='true'] {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);
  box-shadow: inset 2px 0 0 var(--dsw-alias-state-business-primary);
  color: var(--dsw-alias-label-primary);
}

[data-dsh-simplify-check] {
  flex: none;
  color: var(--dsw-alias-state-business-primary);
  font-size: 12px;
}

[data-dsh-simplify-risk-dot] {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dsw-alias-label-quaternary);
}

[data-dsh-simplify-item][data-dsh-simplify-risk='safe'] [data-dsh-simplify-risk-dot] {
  background: var(--dsw-alias-state-success-primary);
}

[data-dsh-simplify-item][data-dsh-simplify-risk='danger'] [data-dsh-simplify-risk-dot] {
  background: var(--dsw-alias-state-error-primary);
}

[data-dsh-simplify-item][data-dsh-simplify-risk='experimental'] [data-dsh-simplify-risk-dot] {
  background: var(--dsw-alias-state-warn-primary);
}

/* —— 思考等级滑块 —— */
[data-dsh-simplify-effort] {
  --dsh-simplify-fill: 0%;
  padding: 10px 14px 8px;
  min-width: 260px;
}

[data-dsh-simplify-effort-head] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

[data-dsh-simplify-effort-title] {
  font-size: 12px;
  color: var(--dsw-alias-label-secondary);
}

[data-dsh-simplify-effort-value] {
  flex: none;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
  color: var(--dsw-alias-state-business-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
}

[data-dsh-simplify-effort-rail] {
  position: relative;
  display: flex;
  align-items: center;
  height: 22px;
}

[data-dsh-simplify-effort-slider] {
  appearance: none;
  width: 100%;
  height: 22px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}

[data-dsh-simplify-effort-slider]:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
  border-radius: 4px;
}

/* 轨道：已选区间用品牌色填充，剩余区间用底色 */
[data-dsh-simplify-effort-slider]::-webkit-slider-runnable-track {
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--dsw-alias-state-business-primary) 0 var(--dsh-simplify-fill),
    var(--dsw-alias-border-l2) var(--dsh-simplify-fill) 100%
  );
}

[data-dsh-simplify-effort-slider]::-moz-range-track {
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-border-l2);
}

[data-dsh-simplify-effort-slider]::-moz-range-progress {
  height: 6px;
  border-radius: 999px;
  background: var(--dsw-alias-state-business-primary);
}

[data-dsh-simplify-effort-slider]::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -5px;
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-2);
  border: 2px solid var(--dsw-alias-state-business-primary);
  box-sizing: border-box;
}

[data-dsh-simplify-effort-slider]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-2);
  border: 2px solid var(--dsw-alias-state-business-primary);
  box-sizing: border-box;
}

/* 标签绝对定位在档位比例处，与滑块轨道（两侧各让出半个滑块）对齐 */
[data-dsh-simplify-effort-scale] {
  position: relative;
  height: 16px;
  margin: 6px 8px 0;
  font-size: 11px;
  color: var(--dsw-alias-label-caption);
  /* 两端标签的中心也要压在刻度上，允许溢出到弹层内边距 */
  overflow: visible;
}

[data-dsh-simplify-effort-scale] > span {
  position: absolute;
  top: 0;
  white-space: nowrap;
}

[data-dsh-simplify-effort-scale] > span[data-active='true'] {
  color: var(--dsw-alias-state-business-primary);
  font-weight: 600;
}

/* —— 子代理委派图（结构照 PI-Desktop SubagentTopology） —— */
[data-dsh-simplify-delegation-source] { display: none !important; }

.subagent-topology-host {
  display: block;
  margin: 8px 0;
}

.subagent-topology {
  display: flex;
  box-sizing: border-box;
  min-width: 0;
  max-width: 640px;
  margin: 0 auto;
  flex-direction: column;
  padding: 2px 0;
}

/* 摘要行常驻：它挂在折叠区之外，宿主收起工作步骤后仍然可见。 */
.subagent-topology-summary {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 6px 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
  border-radius: var(--dsw-radius-md, 8px);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.subagent-topology-summary:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.03));
  border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.subagent-topology-summary:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #2563eb);
  outline-offset: 1px;
}

.subagent-topology-summary-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: var(--dsw-alias-state-business-subtle, rgba(37, 99, 235, 0.08));
  color: var(--dsw-alias-state-business-primary, #2563eb);
}

.subagent-topology-summary-label {
  flex: none;
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #0f1115);
  letter-spacing: -0.01em;
}

.subagent-topology-summary-counts {
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #6b7280);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.subagent-topology-summary-alert {
  color: var(--dsw-alias-state-error-primary, #dc2626);
  font-weight: 500;
}

.subagent-topology-summary-chevron {
  display: inline-flex;
  flex: none;
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary, #9ca3af);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.subagent-topology-summary[aria-expanded='true'] .subagent-topology-summary-chevron {
  transform: rotate(180deg);
}

.subagent-topology-detail {
  display: grid;
  box-sizing: border-box;
  min-width: 0;
  grid-template-columns: minmax(130px, 0.52fr) 34px minmax(248px, 1.48fr);
  align-items: center;
  padding: 14px 12px;
  margin-top: 6px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  border-radius: var(--dsw-radius-lg, 12px);
  background: var(--dsw-alias-interactive-bg-subtle, rgba(0, 0, 0, 0.015));
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}

.subagent-topology.is-collapsed .subagent-topology-detail { display: none; }

.subagent-topology-root {
  display: flex;
  min-width: 0;
  min-height: 68px;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: border-color 0.15s ease;
}

.subagent-topology-root-icon,
.subagent-topology-avatar {
  position: relative;
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04));
  color: var(--dsw-alias-label-secondary, #4b5563);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
}

.subagent-topology-root-icon {
  background: var(--dsw-alias-state-business-subtle, rgba(37, 99, 235, 0.08));
  color: var(--dsw-alias-state-business-primary, #2563eb);
  border: 1px solid var(--dsw-alias-border-l1, rgba(37, 99, 235, 0.15));
}

.subagent-topology-avatar svg,
.subagent-topology-root-icon svg { width: 14px; height: 14px; }

.subagent-topology-root-copy,
.subagent-topology-node-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.subagent-topology-root-copy > [data-dsh-simplify-root-title] {
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #0f1115);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.subagent-topology-root-copy > span {
  margin-top: 2px;
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-size: 11px;
  line-height: 16px;
}

/* 网格里保留这一列做间距；真正的横线由主干画 */
.subagent-topology-connector { height: 2px; background: transparent; }

.subagent-topology-agents {
  position: relative;
  display: grid;
  min-width: 0;
  gap: 10px;
  padding-left: 14px;
}

.subagent-topology-lines {
  position: absolute;
  top: 0;
  left: -34px;
  overflow: visible;
  pointer-events: none;
}

.subagent-topology-lines path {
  stroke: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.15));
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@keyframes dsh-topology-dash {
  to { stroke-dashoffset: -14; }
}

.subagent-topology:has(.outcome-running) .subagent-topology-lines path {
  stroke: var(--dsw-alias-state-business-primary, #2563eb);
  stroke-dasharray: 4 3;
  animation: dsh-topology-dash 1.2s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .subagent-topology:has(.outcome-running) .subagent-topology-lines path {
    animation: none;
    stroke-dasharray: none;
  }
}

.subagent-topology-node {
  position: relative;
  min-width: 0;
  margin: 0;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
  border-radius: var(--dsw-radius-md, 10px);
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
}

.subagent-topology-node:hover {
  border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.15));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.subagent-topology-node-actions { position: relative; }

.subagent-topology-node-header {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 58px;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: inherit;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #4b5563);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.subagent-topology-node-header:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.02)); }
.subagent-topology-node-header:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}

.subagent-topology-status-icon {
  position: absolute;
  right: -3px;
  bottom: -2px;
  display: inline-flex;
  width: 12px;
  height: 12px;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--dsw-alias-bg-layer-2, #ffffff);
  border-radius: 999px;
  background: var(--dsw-alias-label-tertiary);
  color: #ffffff;
}

.subagent-topology-status-icon > span {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: currentColor;
}

.subagent-topology-node.outcome-completed .subagent-topology-status-icon { background: var(--dsw-alias-state-success-primary, #16a34a); }
.subagent-topology-node.outcome-failed .subagent-topology-status-icon { background: var(--dsw-alias-state-error-primary, #dc2626); }
.subagent-topology-node.outcome-denied .subagent-topology-status-icon { background: var(--dsw-alias-label-tertiary, #6b7280); }
.subagent-topology-node.outcome-running .subagent-topology-status-icon { background: var(--dsw-alias-state-business-primary, #2563eb); }

.subagent-topology-node.outcome-running .subagent-topology-status-icon > span {
  animation: dsh-topology-pulse 1s ease-in-out infinite alternate;
}

@keyframes dsh-topology-pulse {
  from { transform: scale(0.8); opacity: 0.7; }
  to { transform: scale(1.2); opacity: 1; }
}

.subagent-topology-node-title-row {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.subagent-topology-node-title {
  min-width: 0;
  flex: 0 1 auto;
  max-width: 60%;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #0f1115);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

.subagent-topology-node-model {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
  color: var(--dsw-alias-label-secondary, #4b5563);
  font-family: var(--dsw-font-family-code, ui-monospace, monospace);
  font-size: 11px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04));
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  white-space: nowrap;
}

.subagent-topology-node-model-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.subagent-topology-node-thinking { flex: none; white-space: pre; color: var(--dsw-alias-label-secondary); }

.subagent-topology-node-status {
  flex: none;
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-family: var(--dsw-font-family-code, ui-monospace, monospace);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  margin-left: auto;
}

.subagent-topology-node.outcome-running .subagent-topology-node-status { color: var(--dsw-alias-state-business-primary, #2563eb); font-weight: 500; }
.subagent-topology-node.outcome-failed .subagent-topology-node-status { color: var(--dsw-alias-state-error-primary, #dc2626); font-weight: 500; }

.subagent-topology-node-summary {
  display: -webkit-box;
  min-width: 0;
  margin-top: 5px;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--dsw-alias-state-error-subtle, rgba(239, 68, 68, 0.08));
  border-left: 2px solid var(--dsw-alias-state-error-primary, #dc2626);
  color: var(--dsw-alias-state-error-primary, #dc2626);
  font-size: 11.5px;
  line-height: 16px;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  word-break: break-word;
}

.subagent-topology-node-steps {
  min-width: 0;
  margin-top: 4px;
  color: var(--dsw-alias-label-tertiary, #6b7280);
  font-family: var(--dsw-font-family-code, ui-monospace, monospace);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 16px;
}

.subagent-topology-spinner {
  flex: none;
  width: 12px;
  height: 12px;
  margin-top: 4px;
  border-radius: 999px;
  border: 1.5px solid var(--dsw-alias-border-l2);
  border-top-color: var(--dsw-alias-state-business-primary, #2563eb);
  animation: dsh-simplify-spin 0.9s linear infinite;
}

@keyframes dsh-simplify-spin { to { transform: rotate(360deg); } }

@media (prefers-reduced-motion: reduce) {
  .subagent-topology-spinner { animation: none; }
}

.subagent-stop-button {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.15));
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2, #ffffff);
  color: var(--dsw-alias-label-secondary, #4b5563);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.subagent-stop-button:hover {
  border-color: var(--dsw-alias-state-error-primary, #dc2626);
  color: var(--dsw-alias-state-error-primary, #dc2626);
  background: var(--dsw-alias-state-error-subtle, rgba(239, 68, 68, 0.08));
}

.subagent-topology-node-actions:has(> .subagent-stop-button) .subagent-topology-node-header { min-height: 88px; }
.subagent-topology-node-actions:has(> .subagent-stop-button) :is(.subagent-topology-node-summary, .subagent-topology-node-steps) { padding-right: 100px; }

/* —— 回合耗时 —— */
[data-dsh-simplify-duration] {
  flex: none;
  margin-left: 2px;
  font-size: var(--dsh-content-font-size-secondary, 13px);
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}

/* —— dock 统计项的百分比配色 —— */
[data-dsh-simplify-pct='good'] {
  color: var(--dsw-alias-state-success-primary);
}

[data-dsh-simplify-pct='warn'] {
  color: var(--dsw-alias-state-warn-label);
}

[data-dsh-simplify-pct='bad'] {
  color: var(--dsw-alias-state-error-primary);
}

/* 上下文环：文字配色之外同步描边，避免出现「彩色数字 + 灰环」 */
[data-dsh-simplify-pct][data-dsh-simplify-pct-kind='context'] svg *[class*='fill'] {
  stroke: currentColor;
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
  align-items: center;
  box-sizing: border-box;
  height: 34px;
  min-width: 0;
  flex: 0 0 34px;
  gap: 6px;
  margin: 0 4px 6px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm);
}

[data-dsh-simplify-sidebar-header] > span:first-child { margin-right: auto; }
[data-dsh-simplify-tabs-host] { flex: none; }
[data-dsh-simplify-native-filter] { display: none !important; }
[data-dsh-simplify-grouping] {
  appearance: none;
  flex: none;
  max-width: 96px;
  padding: 2px 18px 2px 6px;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background:
    linear-gradient(45deg, transparent 50%, var(--dsw-alias-label-caption) 50%) calc(100% - 10px) 50% / 4px 4px no-repeat,
    linear-gradient(135deg, var(--dsw-alias-label-caption) 50%, transparent 50%) calc(100% - 6px) 50% / 4px 4px no-repeat,
    var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font-size: 11px;
}

[data-dsh-simplify-grouping]:hover {
  color: var(--dsw-alias-label-primary);
}
[data-dsh-simplify-dock-right] > [data-dsh-simplify-dock-root] {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* 模型与思考等级之间的分隔点：两侧留出呼吸间隙，避免贴住按钮描边 */
[data-dsh-simplify-separator] {
  flex: none;
  padding: 0 4px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 16px;
  user-select: none;
}
[data-dsh-simplify-control='effort'] { flex: none; }
[data-dsh-simplify-control='model'] { max-width: 240px; }

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
/* —— 工作区列表：密度 / 徽标 / 折叠 / 置顶 —— */
[data-slot='sidebar.workspaces'] [data-row-key^='workspace:'],
[data-slot='sidebar.workspaces'] [data-row-key^='session'] {
  height: 28px;
  min-height: 0;
}

/* 折叠：超出前 N 的组整组隐藏 */
[data-dsh-simplify-collapsed] {
  display: none;
}
[data-slot='sidebar.workspaces'][data-dsh-simplify-filtering] [data-dsh-simplify-collapsed] {
  display: block;
}

/* 置顶：列表容器改 flex 列，置顶组提前（只改顺序，不动 DOM） */
[data-slot='sidebar.workspaces'] *:has(> [data-dsh-simplify-group]) {
  display: flex;
  flex-direction: column;
}

/* 会话数徽标：挂在工作区行末尾的 pseudo 元素上 */
[data-slot='sidebar.workspaces'] [data-row-key^='workspace:'][data-dsh-simplify-count]::after {
  content: attr(data-dsh-simplify-count);
  margin-left: auto;
  padding-left: 6px;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-caption);
}

/* 折叠/置顶控件 */
[data-dsh-simplify-groups-controls] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: relative;
  min-width: 0;
}

[data-dsh-simplify-groups-toggle],
[data-dsh-simplify-pin-toggle] {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  font-size: 11px;
  line-height: 16px;
  padding: 2px 6px;
  border-radius: var(--dsw-radius-sm);
  white-space: nowrap;
}

[data-dsh-simplify-groups-toggle]:hover,
[data-dsh-simplify-pin-toggle]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

[data-dsh-simplify-groups-toggle][hidden] {
  display: none;
}

[data-dsh-simplify-pin-panel] {
  position: fixed;
  z-index: 1100;
  min-width: 180px;
  max-width: 240px;
  max-height: 280px;
  overflow: auto;
  padding: 4px;
  background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-md);
  box-shadow: var(--dsw-elevation-panel);
}

[data-dsh-simplify-pin-panel][hidden] {
  display: none;
}

[data-dsh-simplify-pin-item] {
  appearance: none;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
  display: block;
  width: 100%;
  text-align: left;
  font-size: 12px;
  line-height: 18px;
  padding: 4px 6px;
  border-radius: var(--dsw-radius-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-dsh-simplify-pin-item]:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

[data-dsh-simplify-pin-item][data-active='true'] {
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
`
