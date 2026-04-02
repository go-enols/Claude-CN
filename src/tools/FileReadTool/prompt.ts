import { isPDFSupported } from '../../utils/pdfUtils.js'
import { BASH_TOOL_NAME } from '../BashTool/toolName.js'

// Use a string constant for tool names to avoid circular dependencies
export const FILE_READ_TOOL_NAME = 'Read'

export const FILE_UNCHANGED_STUB =
  '文件自上次读取以来未更改。之前在此对话中的读取工具结果仍然是当前的 — 请参考该结果而不是重新读取。'

export const MAX_LINES_TO_READ = 2000

export const DESCRIPTION = '从本地文件系统读取文件。'

export const LINE_FORMAT_INSTRUCTION =
  '- 结果使用 cat -n 格式返回，行号从 1 开始'

export const OFFSET_INSTRUCTION_DEFAULT =
  "- 您可以选择指定行偏移量和限制（对于长文件特别方便），但建议通过不提供这些参数来读取整个文件"

export const OFFSET_INSTRUCTION_TARGETED =
  '- 当您已经知道需要文件的哪一部分时，只需读取该部分。这对于较大的文件可能很重要。'

/**
 * Renders the Read tool prompt template.  The caller (FileReadTool) supplies
 * the runtime-computed parts.
 */
export function renderPromptTemplate(
  lineFormat: string,
  maxSizeInstruction: string,
  offsetInstruction: string,
): string {
  return `从本地文件系统读取文件。您可以使用此工具直接访问任何文件。如果用户提供文件路径，假定该路径有效。读取不存在的文件是可以的；将返回错误。

用法：
- file_path 参数必须是绝对路径，而不是相对路径
- 默认情况下，它从文件开头读取最多 ${MAX_LINES_TO_READ} 行${maxSizeInstruction}
${offsetInstruction}
${lineFormat}
- 此工具允许 Claude Code 读取图像（例如 PNG、JPG 等）。当读取图像文件时，内容以视觉方式呈现，因为 Claude Code 是多模态 LLM。${
    isPDFSupported()
      ? '\n- 此工具可以读取 PDF 文件（.pdf）。对于大型 PDF（超过 10 页），您必须提供 pages 参数来读取特定的页面范围（例如，pages: "1-5"）。没有 pages 参数读取大型 PDF 将失败。每个请求最多 20 页。'
      : ''
  }
- 此工具可以读取 Jupyter notebooks（.ipynb 文件）并返回所有单元格及其输出，结合代码、文本和可视化。
- 此工具只能读取文件，不能读取目录。要读取目录，请通过 ${BASH_TOOL_NAME} 工具使用 ls 命令。
- 您经常会被要求读取截图。如果用户提供截图的路径，请始终使用此工具查看该路径的文件。此工具适用于所有临时文件路径。
- 如果您读取的文件存在但内容为空，您将收到系统提醒警告，而不是文件内容。`
}
