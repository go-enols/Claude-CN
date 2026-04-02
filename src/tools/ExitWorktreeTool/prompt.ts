export function getExitWorktreeToolPrompt(): string {
  return `退出由 EnterWorktree 创建的 worktree 会话，将会话返回到原始工作目录。

## 范围

此工具仅对本会话中由 EnterWorktree 创建的 worktree 操作。它不会触及：
- 您使用 \`git worktree add\` 手动创建的 worktree
- 来自先前会话的 worktree（即使由 EnterWorktree 创建）
- 如果从未调用过 EnterWorktree，您所在的目录

如果在 EnterWorktree 会话之外调用，该工具是一个**空操作**：报告没有活动的 worktree 会话，不执行任何操作。文件系统状态不变。

## 何时使用

- 用户明确要求"退出 worktree"、"离开 worktree"、"返回"或以其他方式结束 worktree 会话
- 不要主动调用此工具 — 仅在用户要求时才调用

## 参数

- \`action\`（必填）：\`"keep"\` 或 \`"remove"\`
  - \`"keep"\` — 保留 worktree 目录和分支在磁盘上。如果用户想以后再回来，或有更改要保留，请使用此选项。
  - \`"remove"\` — 删除 worktree 目录及其分支。在工作完成或放弃时使用此选项进行干净退出。
- \`discard_changes\`（可选，默认为 false）：仅在 \`action: "remove"\` 时有意义。如果 worktree 有未提交的文件或不在原始分支上的提交，除非将此设置为 \`true\`，否则工具将拒绝删除它。如果工具返回列出更改的错误，请在确认后使用 \`discard_changes: true\` 重新调用。

## 行为

- 将会话的工作目录恢复到 EnterWorktree 之前的位置
- 清除依赖 CWD 的缓存（系统提示部分、内存文件、计划目录），以便会话状态反映原始目录
- 如果有 tmux 会话附加到 worktree：在 \`remove\` 时终止，在 \`keep\` 时保持运行（返回名称以便用户可以重新附加）
- 退出后，可以再次调用 EnterWorktree 创建新的 worktree
`
}
