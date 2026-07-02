import { getLocalMonthYear } from 'src/constants/common.js'
export const WEB_SEARCH_TOOL_NAME = 'WebSearch'
export function getWebSearchPrompt(): string {
  const currentMonthYear = getLocalMonthYear()
  return `
- 允许 Claude 搜索网络，并使用搜索结果来提供答案
- 为当前事件和最新数据提供最新信息
- 返回搜索结果信息，格式化为搜索结果块，包含 Markdown 超链接形式的链接
- 使用此工具访问超出 Claude 知识截止日期范围的信息
- 搜索在单个 API 调用中自动完成
关键要求 - 你必须遵守以下规则：
  - 回答用户问题后，必须在回复末尾添加"来源："部分
  - 在"来源"部分中，将所有搜索结果中的相关 URL 以 Markdown 超链接形式列出：[标题](URL)
  - 这是强制要求 - 永远不要省略在回复中包含来源
  - 示例格式：
    [在此处填写你的回答]
    来源：
    - [来源标题 1](https://example.com/1)
    - [来源标题 2](https://example.com/2)
使用说明：
  - 支持域名过滤，可包含或屏蔽特定网站
  - 网络搜索仅在美国可用
重要提示 - 在搜索查询中使用正确的年份：
  - 当前月份是 ${currentMonthYear}。搜索最新信息、文档或当前事件时，必须使用此年份。
  - 示例：如果用户要求"最新的 React 文档"，请搜索"React 文档"并使用当前年份，而非去年
`
}
