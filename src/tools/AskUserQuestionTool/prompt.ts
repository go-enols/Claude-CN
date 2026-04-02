import { EXIT_PLAN_MODE_TOOL_NAME } from '../ExitPlanModeTool/constants.js'

export const ASK_USER_QUESTION_TOOL_NAME = 'AskUserQuestion'

export const ASK_USER_QUESTION_TOOL_CHIP_WIDTH = 12

export const DESCRIPTION =
  '向用户提出多项选择题以收集信息、澄清歧义、了解偏好、做出决定或向他们提供选择。'

export const PREVIEW_FEATURE_PROMPT = {
  markdown: `
预览功能：
在呈现用户需要直观比较的具体内容时，请使用选项上的可选 \`preview\` 字段：
- UI 布局或组件的 ASCII 模拟
- 显示不同实现的代码片段
- 图表变体
- 配置示例

预览内容在等宽框中呈现为 markdown。支持多行文本和换行。当任何选项有预览时，UI 会切换到并排布局，左侧是垂直选项列表，右侧是预览。不要在简单偏好问题中使用预览，标签和描述就足够了。注意：预览仅支持单选问题（不是 multiSelect）。
`,
  html: `
预览功能：
在呈现用户需要直观比较的具体内容时，请使用选项上的可选 \`preview\` 字段：
- UI 布局或组件的 HTML 模拟
- 显示不同实现的格式化代码片段
- 可视化比较或图表

预览内容必须是自包含的 HTML 片段（无 <html>/<body> 包装器，无 <script> 或 <style> 标签 — 请改用内联样式属性）。不要在简单偏好问题中使用预览，标签和描述就足够了。注意：预览仅支持单选问题（不是 multiSelect）。
`,
} as const

export const ASK_USER_QUESTION_TOOL_PROMPT = `当您需要在执行过程中向用户提问时使用此工具。这允许您：
1. 收集用户偏好或需求
2. 澄清模糊的指令
3. 在工作时获取关于实现选择的决定
4. 向用户提供关于采取什么方向的选择。

用法说明：
- 用户始终能够选择"其他"来提供自定义文本输入
- 使用 multiSelect: true 允许为问题选择多个答案
- 如果您推荐特定选项，请将该选项放在列表第一位，并在标签末尾添加"（推荐）"

计划模式说明：在计划模式下，使用此工具在最终确定计划之前澄清需求或选择方法。不要使用此工具询问"我的计划好了吗？"或"我应该继续吗？" - 使用 ${EXIT_PLAN_MODE_TOOL_NAME} 进行计划批准。重要提示：不要在问题中提及"计划"（例如，"您对计划有反馈吗？"，"计划看起来不错吗？"），因为用户只有在您调用 ${EXIT_PLAN_MODE_TOOL_NAME} 后才能在 UI 中看到计划。如果需要计划批准，请改用 ${EXIT_PLAN_MODE_TOOL_NAME}。
`
