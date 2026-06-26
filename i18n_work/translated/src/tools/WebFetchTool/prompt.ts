export const WEB_FETCH_TOOL_NAME = 'WebFetch'

export const DESCRIPTION = `
- 从指定 URL 获取内容并使用 AI 模型进行处理
- 接受 URL 和提示词作为输入
- 获取 URL 内容，将 HTML 转换为 markdown
- 使用小型快速模型根据提示词处理内容
- 返回模型对内容的响应
- 当您需要检索和分析网页内容时，请使用此工具

使用说明：
  - 重要提示：如果有 MCP 提供的网络获取工具可用，请优先使用该工具，因为它可能限制更少。
  - URL 必须是格式完整的有效 URL
  - HTTP URL 将自动升级为 HTTPS
  - 提示词应描述您希望从页面中提取什么信息
  - 此工具为只读工具，不会修改任何文件
  - 如果内容非常大，结果可能会被摘要
  - 包含一个 15 分钟自动清理的缓存，用于重复访问相同 URL 时加快响应速度
  - 当 URL 重定向到不同的主机时，工具会通知您并以特殊格式提供重定向 URL。您应使用重定向 URL 发起新的 WebFetch 请求以获取内容。
  - 对于 GitHub URL，请优先使用 gh CLI 通过 Bash 工具进行操作（例如 gh pr view、gh issue view、gh api）。
`

export function makeSecondaryModelPrompt(
  markdownContent: string,
  prompt: string,
  isPreapprovedDomain: boolean,
): string {
  const guidelines = isPreapprovedDomain
    ? `根据上述内容提供简洁的回复。根据需要包含相关细节、代码示例和文档摘录。`
    : `仅根据上述内容提供简洁的回复。在您的回复中：
 - 对任何源文档的引用严格限制在 125 个字符以内。只要尊重许可证，开源软件是可以的。
 - 对文章中的精确语言使用引号；引号之外的任何语言都不应与原文逐字相同。
 - 您不是律师，切勿对您自己的提示和回复的合法性发表评论。
 - 切勿生成或复制精确的歌词。`

  return `
网页内容：
---
${markdownContent}
---

${prompt}

${guidelines}
`
}
