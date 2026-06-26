import { isCompactLinePrefixEnabled } from '../../utils/file.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

function getPreReadInstruction(): string {
  return `\n- 在编辑之前，您必须在此对话中至少使用过一次 \`${FILE_READ_TOOL_NAME}\` 工具。如果您在未读取文件的情况下尝试编辑，此工具将报错。 `
}

export function getEditToolDescription(): string {
  return getDefaultEditDescription()
}

function getDefaultEditDescription(): string {
  const prefixFormat = isCompactLinePrefixEnabled()
    ? 'line number + tab'
    : 'spaces + line number + arrow'
  const minimalUniquenessHint =
    process.env.USER_TYPE === 'ant'
      ? `\n- 使用尽可能小的、清晰唯一的 old_string — 通常 2-4 行相邻代码就足够了。避免在只需较少上下文就能唯一标识目标时包含 10 行以上的上下文。`
      : ''
  return `执行文件中的精确字符串替换。

用法：${getPreReadInstruction()}
- 从 Read 工具输出中编辑文本时，请确保保留行号前缀之后的精确缩进（制表符/空格）。行号前缀格式为：${prefixFormat}。其后的所有内容才是需要匹配的实际文件内容。切勿在 old_string 或 new_string 中包含行号前缀的任何部分。
- 始终优先编辑代码库中的现有文件。除非明确要求，否则切勿创建新文件。
- 仅在用户明确要求时才使用表情符号。避免在文件中添加表情符号，除非有明确要求。
- 如果 \`old_string\` 在文件中不唯一，编辑将失败。请提供包含更多周围上下文的更大字符串以使其唯一，或使用 \`replace_all\` 来替换 \`old_string\` 的每个实例。${minimalUniquenessHint}
- 使用 \`replace_all\` 在文件中替换和重命名字符串。例如，如果您想重命名一个变量，此参数非常有用。`
}

