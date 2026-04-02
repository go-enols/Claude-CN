export const PR_TITLE = '添加 Claude Code GitHub 工作流'

export const GITHUB_ACTION_SETUP_DOCS_URL =
  'https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md'

export const WORKFLOW_CONTENT = `name: Claude Code

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  claude:
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@claude')) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@claude') || contains(github.event.issue.title, '@claude')))
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write
      actions: read # Required for Claude to read CI results on PRs
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run Claude Code
        id: claude
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}

          # This is an optional setting that allows Claude to read CI results on PRs
          additional_permissions: |
            actions: read

          # Optional: Give a custom prompt to Claude. If this is not specified, Claude will perform the instructions specified in the comment that tagged it.
          # prompt: 'Update the pull request description to include a summary of changes.'

          # Optional: Add claude_args to customize behavior and configuration
          # See https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md
          # or https://code.claude.com/docs/en/cli-reference for available options
          # claude_args: '--allowed-tools Bash(gh pr:*)'

`

export const PR_BODY = `## 🤖 安装 Claude Code GitHub 应用

此 PR 添加了一个 GitHub Actions 工作流，使我们的仓库能够集成 Claude Code。

### 什么是 Claude Code？

[Claude Code](https://claude.com/claude-code) 是一个 AI 编码代理，可以帮助您：
- 修复错误和改进代码  
- 更新文档
- 实现新功能
- 代码审查和建议
- 编写测试
- 以及更多！

### 工作原理

此 PR 合并后，我们可以通过在拉取请求或问题评论中提及 @claude 来与 Claude 交互。
工作流触发后，Claude 将分析评论和周围上下文，并在 GitHub action 中执行请求。

### 重要说明

- **此工作流在 PR 合并前不会生效**
- **@claude 提及在合并完成后才能使用**
- 每当 Claude 在 PR 或问题评论中被提及时，工作流会自动运行
- Claude 可以访问整个 PR 或问题上下文，包括文件、差异和之前的评论

### 安全性

- 我们的 Anthropic API 密钥安全存储为 GitHub Actions 密钥
- 只有对仓库具有写入权限的用户才能触发工作流
- 所有 Claude 运行都存储在 GitHub Actions 运行历史中
- Claude 的默认工具仅限于读写文件以及通过创建评论、分支和提交来与我们的仓库交互
- 我们可以通过在工作流文件中添加更多允许的工具，例如：

\`\`\`
allowed_tools: Bash(npm install),Bash(npm run build),Bash(npm run lint),Bash(npm run test)
\`\`\`

在 [Claude Code action 仓库](https://github.com/anthropics/claude-code-action) 中有更多信息。

合并此 PR 后，让我们尝试在任何 PR 的评论中提及 @claude 开始使用！`

export const CODE_REVIEW_PLUGIN_WORKFLOW_CONTENT = `name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize, ready_for_review, reopened]
    # Optional: Only run on specific file changes
    # paths:
    #   - "src/**/*.ts"
    #   - "src/**/*.tsx"
    #   - "src/**/*.js"
    #   - "src/**/*.jsx"

jobs:
  claude-review:
    # Optional: Filter by PR author
    # if: |
    #   github.event.pull_request.user.login == 'external-contributor' ||
    #   github.event.pull_request.user.login == 'new-developer' ||
    #   github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'

    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: read
      issues: read
      id-token: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Run Claude Code Review
        id: claude-review
        uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          plugin_marketplaces: 'https://github.com/anthropics/claude-code.git'
          plugins: 'code-review@claude-code-plugins'
          prompt: '/code-review:code-review \${{ github.repository }}/pull/\${{ github.event.pull_request.number }}'
          # See https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md
          # or https://code.claude.com/docs/en/cli-reference for available options

`
