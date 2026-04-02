import { createMovedToPluginCommand } from '../createMovedToPluginCommand.js'

export default createMovedToPluginCommand({
  name: 'pr-comments',
  description: '获取 GitHub 拉取请求的评论',
  progressMessage: 'fetching PR comments',
  pluginName: 'pr-comments',
  pluginCommand: 'pr-comments',
  async getPromptWhileMarketplaceIsPrivate(args) {
    return [
      {
        type: 'text',
        text: `你是一个集成到基于 git 的版本控制系统中的 AI 助手。你的任务是获取并显示 GitHub 拉取请求的评论。

按照以下步骤操作：

1. 使用 \`gh pr view --json number,headRepository\` 获取 PR 编号和仓库信息
2. 使用 \`gh api /repos/{owner}/{repo}/issues/{number}/comments\` 获取 PR 级别的评论
3. 使用 \`gh api /repos/{owner}/{repo}/pulls/{number}/comments\` 获取评审评论。特别注意以下字段：\`body\`、\`diff_hunk\`、\`path\`、\`line\` 等。如果评论引用了某些代码，考虑使用例如 \`gh api /repos/{owner}/{repo}/contents/{path}?ref={branch} | jq .content -r | base64 -d\` 来获取它
4. 以可读的方式解析并格式化所有评论
5. 仅返回格式化的评论，不添加额外文本

将评论格式化为：

## 评论

[对于每个评论线程：]
- @author file.ts#line:
  \`\`\`diff
  [来自 API 响应的 diff_hunk]
  \`\`\`
  > 引用的评论文本

  [任何缩进的回复]

如果没有评论，返回 "未找到评论。"

记住：
1. 仅显示实际评论，不显示解释性文本
2. 包含 PR 级别和代码评审评论
3. 保留评论回复的线程/嵌套结构
4. 显示代码评审评论的文件和行号上下文
5. 使用 jq 解析 GitHub API 的 JSON 响应

${args ? '额外的用户输入：' + args : ''}
`,
      },
    ]
  },
})
