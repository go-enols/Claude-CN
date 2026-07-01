import { BASH_TOOL_NAME } from '../tools/BashTool/toolName.js'
import { FILE_READ_TOOL_NAME } from '../tools/FileReadTool/prompt.js'
import { GREP_TOOL_NAME } from '../tools/GrepTool/prompt.js'
import { WEB_FETCH_TOOL_NAME } from '../tools/WebFetchTool/prompt.js'
import type { ContextData } from './analyzeContext.js'
import { getDisplayPath } from './file.js'
import { formatTokens } from './format.js'
// --
export type SuggestionSeverity = 'info' | 'warning'
export type ContextSuggestion = {
  severity: SuggestionSeverity
  title: string
  detail: string
  /** Estimated tokens that could be saved */
  savingsTokens?: number
}
// Thresholds for triggering suggestions
const LARGE_TOOL_RESULT_PERCENT = 15 // tool results > 15% of context
const LARGE_TOOL_RESULT_TOKENS = 10_000
const READ_BLOAT_PERCENT = 5 // Read results > 5% of context
const NEAR_CAPACITY_PERCENT = 80
const MEMORY_HIGH_PERCENT = 5
const MEMORY_HIGH_TOKENS = 5_000
// --
export function generateContextSuggestions(
  data: ContextData,
): ContextSuggestion[] {
  const suggestions: ContextSuggestion[] = []
  checkNearCapacity(data, suggestions)
  checkLargeToolResults(data, suggestions)
  checkReadResultBloat(data, suggestions)
  checkMemoryBloat(data, suggestions)
  checkAutoCompactDisabled(data, suggestions)
  // Sort: warnings first, then by savings descending
  suggestions.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'warning' ? -1 : 1
    }
    return (b.savingsTokens ?? 0) - (a.savingsTokens ?? 0)
  })
  return suggestions
}
// --
function checkNearCapacity(
  data: ContextData,
  suggestions: ContextSuggestion[],
): void {
  if (data.percentage >= NEAR_CAPACITY_PERCENT) {
    suggestions.push({
      severity: 'warning',
      title: `上下文已使用 ${data.percentage}%`,
      detail: data.isAutoCompactEnabled
        ? '自动压缩即将触发，届时将丢弃较早的消息。请立即使用 /compact 来控制保留哪些内容。'
        : '自动压缩已禁用。请使用 /compact 释放空间，或在 /config 中启用自动压缩。',
    })
  }
}
function checkLargeToolResults(
  data: ContextData,
  suggestions: ContextSuggestion[],
): void {
  if (!data.messageBreakdown) return
  for (const tool of data.messageBreakdown.toolCallsByType) {
    const totalToolTokens = tool.callTokens + tool.resultTokens
    const percent = (totalToolTokens / data.rawMaxTokens) * 100
    if (
      percent < LARGE_TOOL_RESULT_PERCENT ||
      totalToolTokens < LARGE_TOOL_RESULT_TOKENS
    ) {
      continue
    }
    const suggestion = getLargeToolSuggestion(
      tool.name,
      totalToolTokens,
      percent,
    )
    if (suggestion) {
      suggestions.push(suggestion)
    }
  }
}
function getLargeToolSuggestion(
  toolName: string,
  tokens: number,
  percent: number,
): ContextSuggestion | null {
  const tokenStr = formatTokens(tokens)
  switch (toolName) {
    case BASH_TOOL_NAME:
      return {
        severity: 'warning',
        title: `Bash 结果占用了 ${tokenStr} tokens (${percent.toFixed(0)}%)`,
        detail:
          '通过 head、tail 或 grep 管道输出来减少结果大小。避免对大文件使用 cat — 改用 Read 并指定 offset/limit。',
        savingsTokens: Math.floor(tokens * 0.5),
      }
    case FILE_READ_TOOL_NAME:
      return {
        severity: 'info',
        title: `Read 结果占用了 ${tokenStr} tokens (${percent.toFixed(0)}%)`,
        detail:
          '使用 offset 和 limit 参数仅读取所需的部分。避免在仅需几行时重复读取整个文件。',
        savingsTokens: Math.floor(tokens * 0.3),
      }
    case GREP_TOOL_NAME:
      return {
        severity: 'info',
        title: `Grep 结果占用了 ${tokenStr} tokens (${percent.toFixed(0)}%)`,
        detail:
          '添加更具体的模式，或使用 glob 或 type 参数缩小文件类型范围。考虑使用 Glob 而非 Grep 进行文件发现。',
        savingsTokens: Math.floor(tokens * 0.3),
      }
    case WEB_FETCH_TOOL_NAME:
      return {
        severity: 'info',
        title: `WebFetch 结果占用了 ${tokenStr} tokens (${percent.toFixed(0)}%)`,
        detail:
          '网页内容可能非常大。请考虑仅提取所需的具体信息。',
        savingsTokens: Math.floor(tokens * 0.4),
      }
    default:
      if (percent >= 20) {
        return {
          severity: 'info',
          title: `${toolName} 占用了 ${tokenStr} tokens (${percent.toFixed(0)}%)`,
          detail: `此工具消耗了大量上下文空间。`,
          savingsTokens: Math.floor(tokens * 0.2),
        }
      }
      return null
  }
}
function checkReadResultBloat(
  data: ContextData,
  suggestions: ContextSuggestion[],
): void {
  if (!data.messageBreakdown) return
  const callsByType = data.messageBreakdown.toolCallsByType
  const readTool = callsByType.find(t => t.name === FILE_READ_TOOL_NAME)
  if (!readTool) return
  const totalReadTokens = readTool.callTokens + readTool.resultTokens
  const totalReadPercent = (totalReadTokens / data.rawMaxTokens) * 100
  const readPercent = (readTool.resultTokens / data.rawMaxTokens) * 100
  // Skip if already covered by checkLargeToolResults (>= 15% band)
  if (
    totalReadPercent >= LARGE_TOOL_RESULT_PERCENT &&
    totalReadTokens >= LARGE_TOOL_RESULT_TOKENS
  ) {
    return
  }
  if (
    readPercent >= READ_BLOAT_PERCENT &&
    readTool.resultTokens >= LARGE_TOOL_RESULT_TOKENS
  ) {
    suggestions.push({
      severity: 'info',
      title: `文件读取占用了 ${formatTokens(readTool.resultTokens)} tokens (${readPercent.toFixed(0)}%)`,
      detail:
        '如果您正在重复读取文件，请考虑引用之前的读取结果。对于大文件，请使用 offset/limit。',
      savingsTokens: Math.floor(readTool.resultTokens * 0.3),
    })
  }
}
function checkMemoryBloat(
  data: ContextData,
  suggestions: ContextSuggestion[],
): void {
  const totalMemoryTokens = data.memoryFiles.reduce(
    (sum, f) => sum + f.tokens,
    0,
  )
  const memoryPercent = (totalMemoryTokens / data.rawMaxTokens) * 100
  if (
    memoryPercent >= MEMORY_HIGH_PERCENT &&
    totalMemoryTokens >= MEMORY_HIGH_TOKENS
  ) {
    const largestFiles = [...data.memoryFiles]
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 3)
      .map(f => {
        const name = getDisplayPath(f.path)
        return `${name} (${formatTokens(f.tokens)})`
      })
      .join(', ')
    suggestions.push({
      severity: 'info',
      title: `Memory 文件占用了 ${formatTokens(totalMemoryTokens)} tokens (${memoryPercent.toFixed(0)}%)`,
      detail: `最大的文件：${largestFiles}。使用 /memory 查看并清理过时条目。`,
      savingsTokens: Math.floor(totalMemoryTokens * 0.3),
    })
  }
}
function checkAutoCompactDisabled(
  data: ContextData,
  suggestions: ContextSuggestion[],
): void {
  if (
    !data.isAutoCompactEnabled &&
    data.percentage >= 50 &&
    data.percentage < NEAR_CAPACITY_PERCENT
  ) {
    suggestions.push({
      severity: 'info',
      title: '自动压缩已禁用',
      detail:
        '没有自动压缩，您将很快达到上下文上限并丢失对话。请在 /config 中启用它，或手动使用 /compact。',
    })
  }
}