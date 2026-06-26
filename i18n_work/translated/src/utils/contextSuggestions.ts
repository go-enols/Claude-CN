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
        ? '自动压缩即将触发，将丢弃较早的消息。请立即使用 /compact 控制保留内容。'
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
        title: `Bash 结果使用了 ${tokenStr} 令牌 (${percent.toFixed(0)}%)`,
        detail:
          '通过 head、tail 或 grep 管道输出以减少结果大小。避免对大型文件使用 cat — 请改用带 offset/limit 的 Read。',
        savingsTokens: Math.floor(tokens * 0.5),
      }
    case FILE_READ_TOOL_NAME:
      return {
        severity: 'info',
        title: `Read 结果使用了 ${tokenStr} 令牌 (${percent.toFixed(0)}%)`,
        detail:
          '使用 offset 和 limit 参数仅读取所需的部分。当只需要几行时，避免重新读取整个文件。',
        savingsTokens: Math.floor(tokens * 0.3),
      }
    case GREP_TOOL_NAME:
      return {
        severity: 'info',
        title: `Grep 结果使用了 ${tokenStr} 令牌 (${percent.toFixed(0)}%)`,
        detail:
          '添加更具体的模式，或使用 glob 或 type 参数缩小文件类型范围。考虑使用 Glob 而非 Grep 进行文件发现。',
        savingsTokens: Math.floor(tokens * 0.3),
      }
    case WEB_FETCH_TOOL_NAME:
      return {
        severity: 'info',
        title: `WebFetch 结果使用了 ${tokenStr} 令牌 (${percent.toFixed(0)}%)`,
        detail:
          '网页内容可能非常庞大。请考虑仅提取所需的特定信息。',
        savingsTokens: Math.floor(tokens * 0.4),
      }
    default:
      if (percent >= 20) {
        return {
          severity: 'info',
          title: `${toolName} 使用了 ${tokenStr} 令牌 (${percent.toFixed(0)}%)`,
          detail: `此工具正在消耗大量上下文空间。`,
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
      title: `文件读取使用了 ${formatTokens(readTool.resultTokens)} 令牌 (${readPercent.toFixed(0)}%)`,
      detail:
        '如果您正在重复读取文件，请考虑引用之前的读取结果。对于大型文件，请使用 offset/limit。',
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
      title: `Memory 文件使用了 ${formatTokens(totalMemoryTokens)} 令牌 (${memoryPercent.toFixed(0)}%)`,
      detail: `最大文件：${largestFiles}。使用 /memory 审查并清理过时的条目。`,
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
        '如果不启用自动压缩，您可能会达到上下文限制并丢失对话。请在 /config 中启用它，或手动使用 /compact。',
    })
  }
}
