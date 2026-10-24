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

/* dock 行对齐聊天卡片：复用卡片自身的宽度约束，权限/模型贴卡片左右缘 */
[data-composer-dock]:has([data-dsh-simplify-dock]) {
  box-sizing: border-box;
  width: calc(100% - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  max-width: calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));
  margin-left: auto;
  margin-right: auto;
  /* 宿主只在底部留 4px，补到与左右两侧一致的 16px（--dsh-composer-side-clearance） */
  margin-bottom: calc(var(--dsh-composer-side-clearance, 16px) - 4px);
  position: relative;
}

/* 统计项（activity / usage / 上下文表）保持在流内，由两侧 auto margin 挤到中间聚簇 */
[data-composer-dock]:has([data-dsh-simplify-dock]) [data-composer-stat] {
  white-space: nowrap;
}

[data-dsh-simplify-dock-left],
[data-dsh-simplify-dock-right] {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

/* 控件不贴行边：与卡片内 + 按钮的缩进保持一致，避免看起来挤在桌角 */
[data-dsh-simplify-dock-left] { padding-left: 6px; }
[data-dsh-simplify-dock-right] { padding-right: 6px; }

/* 两侧等分：中间统计簇才能以卡片中心对齐（不等分时会被宽的一侧挤偏） */
[data-dsh-simplify-dock-left] {
  order: -1;
  flex: 1 1 0;
  justify-content: flex-start;
}

[data-dsh-simplify-dock-right] {
  order: 1;
  flex: 1 1 0;
  justify-content: flex-end;
}

/* 参考主流选择器：浅底 + 发丝边 + 品牌色图标点，展开时换成品牌色描边。 */
[data-dsh-simplify-pill] {
  appearance: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border-radius: var(--dsw-radius-sm);
  font-size: 12px;
  line-height: 16px;
  min-width: 0;
  max-width: 260px;
}

[data-dsh-simplify-pill]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active);
  border-color: var(--dsw-alias-border-l2);
}

[data-dsh-simplify-pill][aria-expanded='true'] {
  border-color: var(--dsw-alias-state-business-primary);
  background: var(--dsw-alias-interactive-bg-hover-accent);
}

[data-dsh-simplify-pill]:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
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
  border-color: var(--dsw-alias-state-error-secondary);
  color: var(--dsw-alias-label-error);
}

[data-dsh-simplify-control='permission'][data-dsh-simplify-risk='danger'] [data-dsh-simplify-pill-glyph] {
  background: var(--dsw-alias-state-error-primary);
}

[data-dsh-simplify-control='permission'][data-dsh-simplify-risk='experimental'] {
  border-color: var(--dsw-alias-state-warn-secondary);
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

/* —— 子代理编排卡片 —— */
[data-dsh-simplify-delegations-host] { display: block; margin-top: 8px; }

[data-dsh-simplify-delegations] {
  margin: 0 0 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-2);
  overflow: hidden;
}

[data-dsh-simplify-delegation-head] {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

[data-dsh-simplify-delegation-head]:hover { background: var(--dsw-alias-interactive-bg-hover); }

[data-dsh-simplify-delegation-chevron] {
  flex: none;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--dsw-alias-label-caption);
  transition: transform 0.12s ease;
}

[data-dsh-simplify-delegations][data-collapsed='true'] [data-dsh-simplify-delegation-chevron] { transform: rotate(-90deg); }

[data-dsh-simplify-delegation-heading] { font-weight: 600; color: var(--dsw-alias-label-primary); }
[data-dsh-simplify-delegation-summary] { color: var(--dsw-alias-label-tertiary); }
[data-dsh-simplify-delegation-total] {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary);
  font-variant-numeric: tabular-nums;
}

/* 单层图：左侧主 Agent，右侧子代理列表，中间一条连接线 */
[data-dsh-simplify-delegation-graph] {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 4px 12px 12px;
}

[data-dsh-simplify-delegation-root] {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover);
}

[data-dsh-simplify-delegation-root-icon] {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-business-primary);
}

[data-dsh-simplify-delegation-root-copy] {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  font-size: 12px;
}

[data-dsh-simplify-delegation-root-copy] > strong { color: var(--dsw-alias-label-primary); font-weight: 600; }
[data-dsh-simplify-delegation-root-copy] > span { color: var(--dsw-alias-label-tertiary); font-size: 11px; }

[data-dsh-simplify-delegation-connector] {
  flex: none;
  width: 12px;
  height: 1px;
  background: var(--dsw-alias-border-l2);
}

[data-dsh-simplify-delegation-agents] {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
  flex: 1 1 auto;
}

/* 主干：从第一个子代理连到最后一个，避免只剩几条断开的横线 */
[data-dsh-simplify-delegation-agents]::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 18px;
  bottom: 18px;
  width: 1px;
  background: var(--dsw-alias-border-l2);
}

[data-dsh-simplify-delegation-node] {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-md);
}

[data-dsh-simplify-delegation-node]:hover { border-color: var(--dsw-alias-border-l2); }

[data-dsh-simplify-delegation-open] {
  appearance: none;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

[data-dsh-simplify-delegation-open]:hover { background: var(--dsw-alias-interactive-bg-hover); }
[data-dsh-simplify-delegation-open]:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -1px;
}

/* 每个子代理左侧的短横线，接出主 Agent 的连接线 */
[data-dsh-simplify-delegation-node]::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 18px;
  width: 12px;
  height: 1px;
  background: var(--dsw-alias-border-l2);
}

[data-dsh-simplify-delegation-icon] {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--dsw-alias-state-success-primary);
}

[data-dsh-simplify-delegation-icon][data-status='running'] { background: var(--dsw-alias-state-business-primary); }

[data-dsh-simplify-delegation-body] { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
[data-dsh-simplify-delegation-title] { color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 500; }

[data-dsh-simplify-delegation-meta] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

[data-dsh-simplify-delegation-model] {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}

[data-dsh-simplify-delegation-state][data-status='running'] { color: var(--dsw-alias-state-business-primary); }
[data-dsh-simplify-delegation-state][data-status='done'] { color: var(--dsw-alias-state-success-primary); }
[data-dsh-simplify-delegation-state][data-status='failed'] { color: var(--dsw-alias-state-error-primary); }
[data-dsh-simplify-delegation-icon][data-status='failed'] { background: var(--dsw-alias-state-error-primary); }
[data-dsh-simplify-delegation-summary][data-failed='true'] { color: var(--dsw-alias-state-error-primary); }

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
  gap: 6px;
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
