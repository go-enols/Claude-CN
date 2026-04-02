import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'

export const FILE_WRITE_TOOL_NAME = 'Write'
export const DESCRIPTION = '将文件写入本地文件系统。'

function getPreReadInstruction(): string {
  return `\n- 如果这是现有文件，您必须首先使用 ${FILE_READ_TOOL_NAME} 工具读取文件内容。如果未先读取文件，此工具将失败。`
}

export function getWriteToolDescription(): string {
  return `将文件写入本地文件系统。

用法：
- 如果提供的路径已存在文件，此工具将覆盖它。${getPreReadInstruction()}
- 修改现有文件时首选 Edit 工具 — 它只发送差异。仅将此工具用于创建新文件或完全重写。
- 除非用户明确要求，否则切勿创建文档文件（*.md）或 README 文件。
- 仅在用户明确要求时才使用表情符号。避免将表情符号写入文件，除非被要求。`
}
