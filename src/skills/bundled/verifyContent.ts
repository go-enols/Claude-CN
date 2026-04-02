// 发布的快照缺少捆绑的 verify markdown 资产。
// 保持模块形状完整，内容最少，以便 CLI
// 可以构建，并且如果到达该功能可以优雅失败。

export const SKILL_MD = `# 验证

此重建的源代码快照不包括原始捆绑的
verify 技能内容。
`

export const SKILL_FILES: Record<string, string> = {
  'examples/cli.md': '# 验证 CLI 示例\n\n此快照中不可用。\n',
  'examples/server.md': '# 验证服务器示例\n\n此快照中不可用。\n',
}