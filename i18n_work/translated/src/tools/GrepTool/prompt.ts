import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

export const GREP_TOOL_NAME = 'Grep'

export function getDescription(): string {
  return `基于 ripgrep 构建的强大搜索工具

  用法：
  - 搜索任务请始终使用 ${GREP_TOOL_NAME}。切勿将 \`grep\` 或 \`rg\` 作为 ${BASH_TOOL_NAME} 命令调用。${GREP_TOOL_NAME} 工具已针对正确的权限和访问进行了优化。
  - 支持完整的正则表达式语法（例如 "log.*Error"、"function\\s+\\w+"）
  - 使用 glob 参数过滤文件（例如 "*.js"、"**/*.tsx"）或 type 参数（例如 "js"、"py"、"rust"）
  - 输出模式："content" 显示匹配行，"files_with_matches" 仅显示文件路径（默认），"count" 显示匹配计数
  - 对于需要多轮的开放式搜索，请使用 ${AGENT_TOOL_NAME} 工具
  - 模式语法：使用 ripgrep（而非 grep）- 字面量花括号需要转义（使用 \`interface\\{\\}\` 来查找 Go 代码中的 \`interface{}\`）
  - 多行匹配：默认情况下模式仅匹配单行。对于跨行模式如 \`struct \\{[\\s\\S]*?field\`，请使用 \`multiline: true\`
`
}

