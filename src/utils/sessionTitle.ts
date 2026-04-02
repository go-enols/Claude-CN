/**
 * Session title generation via Haiku.
 *
 * Standalone module with minimal dependencies so it can be imported from
 * print.ts (SDK control request handler) without pulling in the React/chalk/
 * git dependency chain that teleport.tsx carries.
 *
 * This is the single source of truth for AI-generated session titles across
 * all surfaces. Previously there were separate Haiku title generators:
 * - teleport.tsx generateTitleAndBranch (6-word title + branch for CCR)
 * - rename/generateSessionName.ts (kebab-case name for /rename)
 * Each remains for backwards compat; new callers should use this module.
 */

import { z } from 'zod/v4'
import { getIsNonInteractiveSession } from '../bootstrap/state.js'
import { logEvent } from '../services/analytics/index.js'
import { queryHaiku } from '../services/api/claude.js'
import type { Message } from '../types/message.js'
import { logForDebugging } from './debug.js'
import { safeParseJSON } from './json.js'
import { lazySchema } from './lazySchema.js'
import { extractTextContent } from './messages.js'
import { asSystemPrompt } from './systemPromptType.js'

const MAX_CONVERSATION_TEXT = 1000

/**
 * Flatten a message array into a single text string for Haiku title input.
 * Skips meta/non-human messages. Tail-slices to the last 1000 chars so
 * recent context wins when the conversation is long.
 */
export function extractConversationText(messages: Message[]): string {
  const parts: string[] = []
  for (const msg of messages) {
    if (msg.type !== 'user' && msg.type !== 'assistant') continue
    if ('isMeta' in msg && msg.isMeta) continue
    if ('origin' in msg && msg.origin && msg.origin.kind !== 'human') continue
    const content = msg.message.content
    if (typeof content === 'string') {
      parts.push(content)
    } else if (Array.isArray(content)) {
      for (const block of content) {
        if ('type' in block && block.type === 'text' && 'text' in block) {
          parts.push(block.text as string)
        }
      }
    }
  }
  const text = parts.join('\n')
  return text.length > MAX_CONVERSATION_TEXT
    ? text.slice(-MAX_CONVERSATION_TEXT)
    : text
}

const SESSION_TITLE_PROMPT = `生成一个简洁的、句子大小写的标题（3-7 个词），概括此编码会话的主要主题或目标。标题应足够清晰，以便用户在列表中识别该会话。使用句子大小写：仅首字母和专有名词大写。

返回包含单个 "title" 字段的 JSON。

好的示例：
{"title": "修复移动端登录按钮"}
{"title": "添加 OAuth 认证"}
{"title": "调试失败的 CI 测试"}
{"title": "重构 API 客户端错误处理"}

不好（太模糊）：{"title": "代码更改"}
不好（太长）：{"title": "调查并修复移动设备上登录按钮无响应的问题"}
不好（大小写错误）：{"title": "Fix Login Button On Mobile"}`

const titleSchema = lazySchema(() => z.object({ title: z.string() }))

/**
 * Generate a sentence-case session title from a description or first message.
 * Returns null on error or if Haiku returns an unparseable response.
 *
 * @param description - The user's first message or a description of the session
 * @param signal - Abort signal for cancellation
 */
export async function generateSessionTitle(
  description: string,
  signal: AbortSignal,
): Promise<string | null> {
  const trimmed = description.trim()
  if (!trimmed) return null

  try {
    const result = await queryHaiku({
      systemPrompt: asSystemPrompt([SESSION_TITLE_PROMPT]),
      userPrompt: trimmed,
      outputFormat: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
          required: ['title'],
          additionalProperties: false,
        },
      },
      signal,
      options: {
        querySource: 'generate_session_title',
        agents: [],
        // Reflect the actual session mode — this module is called from
        // both the SDK print path (non-interactive) and the CCR remote
        // session path via useRemoteSession (interactive).
        isNonInteractiveSession: getIsNonInteractiveSession(),
        hasAppendSystemPrompt: false,
        mcpTools: [],
      },
    })

    const text = extractTextContent(result.message.content)

    const parsed = titleSchema().safeParse(safeParseJSON(text))
    const title = parsed.success ? parsed.data.title.trim() || null : null

    logEvent('tengu_session_title_generated', { success: title !== null })

    return title
  } catch (error) {
    logForDebugging(`generateSessionTitle failed: ${error}`, {
      level: 'error',
    })
    logEvent('tengu_session_title_generated', { success: false })
    return null
  }
}
