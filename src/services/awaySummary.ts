import { APIUserAbortError } from '@anthropic-ai/sdk'
import { getEmptyToolPermissionContext } from '../Tool.js'
import type { Message } from '../types/message.js'
import { logForDebugging } from '../utils/debug.js'
import {
  createUserMessage,
  getAssistantMessageText,
} from '../utils/messages.js'
import { getSmallFastModel } from '../utils/model/model.js'
import { asSystemPrompt } from '../utils/systemPromptType.js'
import { queryModelWithoutStreaming } from './api/claude.js'
import { getSessionMemoryContent } from './SessionMemory/sessionMemoryUtils.js'

// 回顾只需要最近的上下文 — 截断以避免大型会话上"提示太长"。
// 30 条消息 ≈ ~15 次对话，足以了解"我们从哪里停下"。
const RECENT_MESSAGE_WINDOW = 30

function buildAwaySummaryPrompt(memory: string | null): string {
  const memoryBlock = memory
    ? `会话记忆（更广泛的上下文）：\n${memory}\n\n`
    : ''
  return `${memoryBlock}用户离开后回来了。精确写 1-3 个短句。首先说明高级任务 — 他们正在构建或调试什么，而不是实现细节。接下来：具体的下一步。跳过状态报告和提交回顾。`
}

/**
 * 为"您离开期间"卡片生成简短的会话回顾。
 * 如果中止、空记录或错误则返回 null。
 */
export async function generateAwaySummary(
  messages: readonly Message[],
  signal: AbortSignal,
): Promise<string | null> {
  if (messages.length === 0) {
    return null
  }

  try {
    const memory = await getSessionMemoryContent()
    const recent = messages.slice(-RECENT_MESSAGE_WINDOW)
    recent.push(createUserMessage({ content: buildAwaySummaryPrompt(memory) }))
    const response = await queryModelWithoutStreaming({
      messages: recent,
      systemPrompt: asSystemPrompt([]),
      thinkingConfig: { type: 'disabled' },
      tools: [],
      signal,
      options: {
        getToolPermissionContext: async () => getEmptyToolPermissionContext(),
        model: getSmallFastModel(),
        toolChoice: undefined,
        isNonInteractiveSession: false,
        hasAppendSystemPrompt: false,
        agents: [],
        querySource: 'away_summary',
        mcpTools: [],
        skipCacheWrite: true,
      },
    })

    if (response.isApiErrorMessage) {
      logForDebugging(
        `[awaySummary] API error: ${getAssistantMessageText(response)}`,
      )
      return null
    }
    return getAssistantMessageText(response)
  } catch (err) {
    if (err instanceof APIUserAbortError || signal.aborted) {
      return null
    }
    logForDebugging(`[awaySummary] generation failed: ${err}`)
    return null
  }
}
