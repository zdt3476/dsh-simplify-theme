/**
 * 工作区列表的快速筛选（type-to-filter）。
 *
 * WorkspaceBrowser 没有暴露列表 slot，因此在 sectionHeader 里注入一个
 * 输入框，直接对已渲染的 `[data-row-key]` 行做显示/隐藏。纯函数
 * `computeHiddenRows` 独立可测；DOM 侧只负责取行、应用结果、观察重渲染。
 *
 * 已知限制：筛选作用于当前已渲染的行；折叠的工作区看不到子会话行，
 * 因此折叠组只按工作区标题匹配。
 */

export interface RowInfo {
  key: string
  text: string
}

/** 输入一行序列，返回应隐藏的行 key 集合。 */
export function computeHiddenRows(rows: readonly RowInfo[], rawQuery: string): Set<string> {
  const hidden = new Set<string>()
  const query = rawQuery.trim().toLowerCase()
  if (query === '') return hidden

  // 行按文档顺序分组：每个 workspace: 行领一段（flat 模式没有 workspace 行，整段是一组）。
  const groups: Array<{ workspace: RowInfo | null; members: RowInfo[] }> = [{ workspace: null, members: [] }]
  for (const row of rows) {
    if (row.key.startsWith('workspace:')) groups.push({ workspace: row, members: [] })
    else groups[groups.length - 1].members.push(row)
  }

  for (const group of groups) {
    const workspaceHit = group.workspace !== null && group.workspace.text.includes(query)
    const memberHits = group.members.filter((member) => member.text.includes(query))
    if (group.workspace !== null && !workspaceHit && memberHits.length === 0) hidden.add(group.workspace.key)
    for (const member of group.members) {
      // 工作区命中只保留组头本身；成员仍按各自文本过滤。
      if (!member.text.includes(query)) hidden.add(member.key)
    }
  }
  return hidden
}

/** 从 DOM 行读取 RowInfo；非元素行忽略。 */
export function readRow(row: Element): RowInfo {
  return {
    key: row.getAttribute('data-row-key') ?? '',
    text: (row.textContent ?? '').toLowerCase()
  }
}
