import { isCompactLinePrefixEnabled } from '../../utils/file.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

function getPreReadInstruction(): string {
  return `\n- 您必须在对话中至少使用一次 \`${FILE_READ_TOOL_NAME}\` 工具，然后再进行编辑。如果未读取文件就尝试编辑，此工具将报错。 `
}

export function getEditToolDescription(): string {
  return getDefaultEditDescription()
}

function getDefaultEditDescription(): string {
  const prefixFormat = isCompactLinePrefixEnabled()
    ? '行号 + 制表符'
    : '空格 + 行号 + 箭头'
  const minimalUniquenessHint =
    process.env.USER_TYPE === 'ant'
      ? `\n- 使用最小且明确唯一的 old_string —— 通常 2-4 行相邻行就足够了。避免包含 10 行以上的上下文，因为较少的上下文能更独特地标识目标。`
      : ''
  return `在文件中执行精确的字符串替换。

用法：${getPreReadInstruction()}
- 从 Read 工具输出编辑文本时，确保保留与行号前缀后显示的完全相同的缩进（制表符/空格）。行号前缀格式为：${prefixFormat}。其后面的所有内容才是要匹配的实际文件内容。切勿在 old_string 或 new_string 中包含行号前缀的任何部分。
- 始终优先编辑代码库中的现有文件。切勿写新文件，除非明确要求。
- 仅在用户明确要求时才使用表情符号。避免向文件添加表情符号，除非被要求。
- 如果 \`old_string\` 在文件中不唯一，编辑将失败。请提供包含更多周围上下文的大字符串以使其唯一，或使用 \`replace_all\` 更改 \`old_string\` 的每个实例。${minimalUniquenessHint}
- 使用 \`replace_all\` 在文件中替换和重命名字符串。如果您想重命名变量，此参数很有用。`
}
