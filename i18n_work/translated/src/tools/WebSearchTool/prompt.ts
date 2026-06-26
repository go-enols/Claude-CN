import { getLocalMonthYear } from 'src/constants/common.js'

export const WEB_SEARCH_TOOL_NAME = 'WebSearch'

export function getWebSearchPrompt(): string {
  const currentMonthYear = getLocalMonthYear()
  return `
- 允许 Claude 搜索网络并使用结果来丰富回答
- 为当前事件和最新数据提供最新信息
- 返回格式化为搜索结果显示块的搜索结果信息，包含以 markdown 超链接形式呈现的链接
- 使用此工具获取超出 Claude 知识截止日期的信息
- 搜索在单个 API 调用中自动执行

关键要求 - 您必须遵循以下规则：
  - 回答用户问题后，您必须在回复末尾包含"来源："部分
  - 在"来源"部分中，以 markdown 超链接形式列出搜索结果中的所有相关 URL：[标题](URL)
  - 这是强制性的 - 切勿在回复中省略来源
  - 示例格式：

    [您的回答在此]

    来源：
    - [来源标题 1](https://example.com/1)
    - [来源标题 2](https://example.com/2)

使用说明：
  - 支持域名过滤，可包含或屏蔽特定网站
  - 网络搜索仅在美国可用

重要提示 - 在搜索查询中使用正确的年份：
  - 当前月份是 ${currentMonthYear}。搜索最新信息、文档或当前事件时，必须使用此年份。
  - 示例：如果用户询问"最新的 React 文档"，请使用当前年份搜索"React 文档"，而非去年
`
}

