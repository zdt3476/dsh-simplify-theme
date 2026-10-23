/** 侧栏注入点集中定位，避免多个控件挂到不同层级。 */
export function sidebarHeader(slot: Element): HTMLElement | null {
  const search = slot.querySelector<HTMLButtonElement>('button[aria-label="搜索会话"], button[aria-label="Search sessions"]')
  return search?.parentElement?.parentElement?.parentElement ?? null
}
