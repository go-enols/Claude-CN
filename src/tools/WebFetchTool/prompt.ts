export const WEB_FETCH_TOOL_NAME = 'WebFetch'
export const DESCRIPTION = `
- 从指定 URL 获取内容并使用 AI 模型处理
- 接收 URL 和提示词作为输入
- 获取 URL 内容，将 HTML 转换为 Markdown
- 使用小型快速模型处理内容和提示词
- 返回模型对内容的响应
- 当你需要获取和分析网页内容时使用此工具
使用说明：
  - 重要提示：如果有 MCP 提供的网页获取工具可用，优先使用该工具而非此工具，因为它可能限制更少。
  - URL 必须是完整有效的 URL
  - HTTP URL 将自动升级为 HTTPS
  - 提示词应描述你想从页面中提取的信息
  - 此工具为只读工具，不会修改任何文件
  - 如果内容非常大，结果可能会被摘要
  - 包含一个 15 分钟自动清理的缓存，用于重复访问相同 URL 时加快响应速度
  - 当 URL 重定向到不同的主机时，工具会通知你并以特殊格式提供重定向 URL。然后你应该使用重定向 URL 发起新的 WebFetch 请求来获取内容。
  - 对于 GitHub URL，优先使用 gh CLI 通过 Bash 替代（例如 gh pr view、gh issue view、gh api）。
`
export function makeSecondaryModelPrompt(
  markdownContent: string,
  prompt: string,
  isPreapprovedDomain: boolean,
): string {
  const guidelines = isPreapprovedDomain
    ? `根据上述内容提供简洁的回复。根据需要包含相关细节、代码示例和文档摘录。`
    : `仅根据上述内容提供简洁的回复。在你的回复中：
 - 对任何源文档的引用严格执行 125 字符的最大限制。开源软件可以，只要遵守许可协议即可。
 - 使用引号标注文章中的确切措辞；引号外的任何语言绝不应与原文逐字相同。
 - 你不是律师，绝不要评论你自己提示词和回复的合法性。
 - 绝不要生成或复制完整的歌曲歌词。`
  return `
网页内容：
---
${markdownContent}
---
${prompt}
${guidelines}
`
}
