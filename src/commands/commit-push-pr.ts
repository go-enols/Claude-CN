import type { Command } from '../commands.js'
import {
  getAttributionTexts,
  getEnhancedPRAttribution,
} from '../utils/attribution.js'
import { getDefaultBranch } from '../utils/git.js'
import { executeShellCommandsInPrompt } from '../utils/promptShellExecution.js'
import { getUndercoverInstructions, isUndercover } from '../utils/undercover.js'

const ALLOWED_TOOLS = [
  'Bash(git checkout --branch:*)',
  'Bash(git checkout -b:*)',
  'Bash(git add:*)',
  'Bash(git status:*)',
  'Bash(git push:*)',
  'Bash(git commit:*)',
  'Bash(gh pr create:*)',
  'Bash(gh pr edit:*)',
  'Bash(gh pr view:*)',
  'Bash(gh pr merge:*)',
  'ToolSearch',
  'mcp__slack__send_message',
  'mcp__claude_ai_Slack__slack_send_message',
]

function getPromptContent(
  defaultBranch: string,
  prAttribution?: string,
): string {
  const { commit: commitAttribution, pr: defaultPrAttribution } =
    getAttributionTexts()
  // Use provided PR attribution or fall back to default
  const effectivePrAttribution = prAttribution ?? defaultPrAttribution
  const safeUser = process.env.SAFEUSER || ''
  const username = process.env.USER || ''

  let prefix = ''
  let reviewerArg = ' 和 `--reviewer anthropics/claude-code`'
  let addReviewerArg = '（并添加 `--add-reviewer anthropics/claude-code`）'
  let changelogSection = `

## 变更日志
<!-- CHANGELOG:START -->
[如果此 PR 包含面向用户的更改，请在此处添加变更日志条目。否则，请删除此部分。]
<!-- CHANGELOG:END -->`
  let slackStep = `

5. 创建/更新 PR 后，检查用户的 CLAUDE.md 是否提到发布到 Slack 频道。如果有，使用 ToolSearch 搜索“slack send message”工具。如果 ToolSearch 找到了 Slack 工具，询问用户是否希望你将 PR URL 发布到相关的 Slack 频道。仅在用户确认后发布。如果 ToolSearch 返回无结果或错误，静默跳过此步骤——不要提及失败，不要尝试变通方法，也不要尝试其他方法。`
  if (process.env.USER_TYPE === 'ant' && isUndercover()) {
    prefix = getUndercoverInstructions() + '\n'
    reviewerArg = ''
    addReviewerArg = ''
    changelogSection = ''
    slackStep = ''
  }

  return `${prefix}## 上下文

- \`SAFEUSER\`: ${safeUser}
- \`whoami\`: ${username}
- \`git status\`: !\`git status\`
- \`git diff HEAD\`: !\`git diff HEAD\`
- \`git branch --show-current\`: !\`git branch --show-current\`
- \`git diff ${defaultBranch}...HEAD\`: !\`git diff ${defaultBranch}...HEAD\`
- \`gh pr view --json number 2>/dev/null || true\`: !\`gh pr view --json number 2>/dev/null || true\`

## Git 安全协议

- 绝不要更新 git 配置
- 绝不要运行破坏性/不可逆的 git 命令（如 push --force、hard reset 等），除非用户明确要求
- 绝不要跳过钩子（--no-verify、--no-gpg-sign 等），除非用户明确要求
- 绝不要对 main/master 运行 force push，如果用户要求则警告用户
- 不要提交可能包含机密的文件（.env、credentials.json 等）
- 永远不要使用带 -i 标志的 git 命令（如 git rebase -i 或 git add -i），因为它们需要不支持的交互式输入

## 你的任务

分析将包含在拉取请求中的所有更改，确保查看所有相关提交（不只是最新提交，而是所有将从上面的 git diff ${defaultBranch}...HEAD 输出包含在拉取请求中的提交）。

基于上述更改：
1. 如果在 ${defaultBranch} 上，则创建一个新分支（使用上面上下文中的 SAFEUSER 作为分支名称前缀，如果 SAFEUSER 为空则回退到 whoami，例如 \`username/feature-name\`）
2. 使用 heredoc 语法创建一个带有适当消息的单个提交${commitAttribution ? `，以示例下方显示的归属文本结尾` : ''}：
\`\`\`
git commit -m "$(cat <<'EOF'
提交消息在此处。${commitAttribution ? `\n\n${commitAttribution}` : ''}
EOF
)"
\`\`\`
3. 将分支推送到 origin
4. 如果此分支已存在 PR（检查上面的 gh pr view 输出），使用 \`gh pr edit\` 更新 PR 标题和正文以反映当前的差异${addReviewerArg}。否则，使用 \`gh pr create\` 创建一个拉取请求，并使用 heredoc 语法作为正文${reviewerArg}。
   - 重要：保持 PR 标题简短（70 个字符以下）。将详细信息放在正文中。
\`\`\`
gh pr create --title "简短、描述性的标题" --body "$(cat <<'EOF'
## 摘要
<1-3 个项目符号>

## 测试计划
[用于测试拉取请求的项目符号式 markdown 待办事项清单...]${changelogSection}${effectivePrAttribution ? `\n\n${effectivePrAttribution}` : ''}
EOF
)"
\`\`\`

你能够在单个响应中调用多个工具。你必须在单个消息中完成上述所有操作。${slackStep}

完成后返回 PR URL，以便用户可以看到它。`
}

const command = {
  type: 'prompt',
  name: 'commit-push-pr',
  description: '提交、推送并创建 PR',
  allowedTools: ALLOWED_TOOLS,
  get contentLength() {
    // Use 'main' as estimate for content length calculation
    return getPromptContent('main').length
  },
  progressMessage: '正在创建提交和 PR',
  source: 'builtin',
  async getPromptForCommand(args, context) {
    // Get default branch and enhanced PR attribution
    const [defaultBranch, prAttribution] = await Promise.all([
      getDefaultBranch(),
      getEnhancedPRAttribution(context.getAppState),
    ])
    let promptContent = getPromptContent(defaultBranch, prAttribution)

    // Append user instructions if args provided
    const trimmedArgs = args?.trim()
    if (trimmedArgs) {
      promptContent += `\n\n## 用户附加指令\n\n${trimmedArgs}`
    }

    const finalContent = await executeShellCommandsInPrompt(
      promptContent,
      {
        ...context,
        getAppState() {
          const appState = context.getAppState()
          return {
            ...appState,
            toolPermissionContext: {
              ...appState.toolPermissionContext,
              alwaysAllowRules: {
                ...appState.toolPermissionContext.alwaysAllowRules,
                command: ALLOWED_TOOLS,
              },
            },
          }
        },
      },
      '/commit-push-pr',
    )

    return [{ type: 'text', text: finalContent }]
  },
} satisfies Command

export default command
