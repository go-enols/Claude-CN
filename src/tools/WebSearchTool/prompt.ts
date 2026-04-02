import { getLocalMonthYear } from 'src/constants/common.js'

export const WEB_SEARCH_TOOL_NAME = 'WebSearch'

export function getWebSearchPrompt(): string {
  const currentMonthYear = getLocalMonthYear()
  return `
- 允许 Claude 搜索网络并使用结果来回复
- 为当前事件和最新数据提供最新信息
- 返回格式化为搜索结果块的信息，包括作为 markdown 超链接的链接
- 在需要访问超出 Claude 知识截止日期的信息时使用此工具
- 搜索在单个 API 调用内自动执行

关键要求 - 您必须遵循此要求：
  - 回答用户问题后，您必须在回复末尾包含"来源："部分
  - 在来源部分中，将搜索结果中的所有相关 URL 列为 markdown 超链接：[标题](URL)
  - 这是强制性的 - 永远不要跳过在回复中包含来源
  - 示例格式：

    [您的答案在此]

    来源：
    - [来源标题 1](https://example.com/1)
    - [来源标题 2](https://example.com/2)

用法说明：
  - 支持域过滤以包含或阻止特定网站
  - 网络搜索仅在美国可用

重要 - 在搜索查询中使用正确的年份：
  - 当前月份是 ${currentMonthYear}。搜索最近的信息、文档或当前事件时，您必须使用此年份。
  - 示例：如果用户询问"最新的 React 文档"，请使用当前年份搜索"React 文档"，而不是去年
`
}
