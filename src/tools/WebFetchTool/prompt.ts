export const WEB_FETCH_TOOL_NAME = 'WebFetch'

export const DESCRIPTION = `
- 从指定 URL 获取内容并使用 AI 模型进行处理
- 接受 URL 和提示作为输入
- 获取 URL 内容，将 HTML 转换为 markdown
- 使用提示通过一个小型快速模型处理内容
- 返回模型关于该内容的回复
- 在需要检索和分析网络内容时使用此工具

用法说明：
  - 重要提示：如果有 MCP 提供的网络获取工具可用，请优先使用该工具，因为它可能限制更少
  - URL 必须是完整有效的 URL
  - HTTP URL 将自动升级为 HTTPS
  - 提示应描述您想从页面提取什么信息
  - 此工具是只读的，不会修改任何文件
  - 如果内容非常大，结果可能会被摘要
  - 包含一个 15 分钟的自动清理缓存，以便在重复访问相同 URL 时更快地响应
  - 当 URL 重定向到不同主机时，工具将通知您并以特殊格式提供重定向 URL。然后您应该使用重定向 URL 发出新的 WebFetch 请求来获取内容
  - 对于 GitHub URL，请优先通过 Bash 使用 gh CLI（例如，gh pr view、gh issue view、gh api）
`

export function makeSecondaryModelPrompt(
  markdownContent: string,
  prompt: string,
  isPreapprovedDomain: boolean,
): string {
  const guidelines = isPreapprovedDomain
    ? `根据上述内容提供简洁的回复。根据需要包含相关详细信息、代码示例和文档摘录。`
    : `仅根据上述内容提供简洁的回复。在您的回复中：
 - 对任何来源文档的引用强制执行 125 个字符的最大引用长度。只要我们尊重许可证，开源软件是可以的。
 - 对文章中的确切语言使用引号；引号外的任何语言永远不应该逐字相同。
 - 您不是律师，永远不要评论您自己的提示和回复的合法性。
 - 永远不要产生或复制确切的歌词。`

  return `
网页内容：
---
${markdownContent}
---

${prompt}

${guidelines}
`
}
