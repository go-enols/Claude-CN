export function getPrompt(): string {
  return `
# TeamDelete
当团队工作完成后，删除团队和任务目录。
此操作将：
- 删除团队目录（\`~/.claude/teams/{team-name}/\`）
- 删除任务目录（\`~/.claude/tasks/{team-name}/\`）
- 清除当前会话中的团队上下文
**重要提示**：如果团队仍有活跃成员，TeamDelete 将失败。请先优雅地终止所有团队成员，然后在所有成员关闭后调用 TeamDelete。
当所有团队成员都已完成工作，且你想清理团队资源时使用此工具。团队名称会自动从当前会话的团队上下文中确定。
`.trim()
}
