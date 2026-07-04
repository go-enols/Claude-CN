import { randomUUID, type UUID } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { getOriginalCwd, getSessionId } from '../../bootstrap/state.js'
import type { LocalJSXCommandContext } from '../../commands.js'
import { logEvent } from '../../services/analytics/index.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import type {
  ContentReplacementEntry,
  Entry,
  LogOption,
  SerializedMessage,
  TranscriptMessage,
} from '../../types/logs.js'
import { parseJSONL } from '../../utils/json.js'
import {
  getProjectDir,
  getTranscriptPath,
  getTranscriptPathForSession,
  isTranscriptMessage,
  saveCustomTitle,
  searchSessionsByCustomTitle,
} from '../../utils/sessionStorage.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { escapeRegExp } from '../../utils/stringUtils.js'

type TranscriptEntry = TranscriptMessage & {
  forkedFrom?: {
    sessionId: string
    messageUuid: UUID
  }
}

/**
 * 从第一条用户消息派生单行标题基础。
 * 折叠空白字符 — 多行第一条消息（粘贴的堆栈、代码）
 * 否则会流入保存的标题并破坏恢复提示。
 */
export function deriveFirstPrompt(
  firstUserMessage: Extract<SerializedMessage, { type: 'user' }> | undefined,
): string {
  const content = firstUserMessage?.message?.content
  if (!content) return '派生的对话'
  const raw =
    typeof content === 'string'
      ? content
      : content.find(
          (block): block is { type: 'text'; text: string } =>
            block.type === 'text',
        )?.text
  if (!raw) return '派生的对话'
  return (
    raw.replace(/\s+/g, ' ').trim().slice(0, 100) || '派生的对话'
  )
}

/**
 * 通过从转录文件复制创建当前对话的派生。
 * 在更新 sessionId 并添加 forkedFrom 可追溯性的同时，保留所有原始元数据（时间戳、gitBranch 等）。
 */
async function createFork(customTitle?: string): Promise<{
  sessionId: UUID
  title: string | undefined
  forkPath: string
  serializedMessages: SerializedMessage[]
  contentReplacementRecords: ContentReplacementEntry['replacements']
}> {
  const forkSessionId = randomUUID() as UUID
  const originalSessionId = getSessionId()
  const projectDir = getProjectDir(getOriginalCwd())
  const forkSessionPath = getTranscriptPathForSession(forkSessionId)
  const currentTranscriptPath = getTranscriptPath()

  // 确保项目目录存在
  await mkdir(projectDir, { recursive: true, mode: 0o700 })

  // 读取当前转录文件
  let transcriptContent: Buffer
  try {
    transcriptContent = await readFile(currentTranscriptPath)
  } catch {
    throw new Error('没有可派生的对话')
  }

  if (transcriptContent.length === 0) {
    throw new Error('没有可派生的对话')
  }

  // 解析所有转录条目（消息 + 元数据条目如 content-replacement）
  const entries = parseJSONL<Entry>(transcriptContent)

  // 过滤仅保留主对话消息（排除侧链和非消息条目）
  const mainConversationEntries = entries.filter(
    (entry): entry is TranscriptMessage =>
      isTranscriptMessage(entry) && !entry.isSidechain,
  )

  // 原始会话的 content-replacement 条目。这些记录了哪些
  // tool_result 块被每条消息预算的预览替换了。
  // 如果派生的 JSONL 中没有它们，`claude -r {forkId}` 将使用
  // 空的 replacements Map 重建状态 → 以前被替换的结果被分类为
  // FROZEN 并作为完整内容发送（提示缓存未命中 + 永久超额）。
  // sessionId 必须重写，因为 loadTranscriptFile 按键查找会话的
  // 消息的 sessionId。
  const contentReplacementRecords = entries
    .filter(
      (entry): entry is ContentReplacementEntry =>
        entry.type === 'content-replacement' &&
        entry.sessionId === originalSessionId,
    )
    .flatMap(entry => entry.replacements)

  if (mainConversationEntries.length === 0) {
    throw new Error('没有可派生的消息')
  }

  // 使用新的 sessionId 和保留的元数据构建派生条目
  let parentUuid: UUID | null = null
  const lines: string[] = []
  const serializedMessages: SerializedMessage[] = []

  for (const entry of mainConversationEntries) {
    // Create forked transcript entry preserving all original metadata
    const forkedEntry: TranscriptEntry = {
      ...entry,
      sessionId: forkSessionId,
      parentUuid,
      isSidechain: false,
      forkedFrom: {
        sessionId: originalSessionId,
        messageUuid: entry.uuid,
      },
    }

    // Build serialized message for LogOption
    const serialized: SerializedMessage = {
      ...entry,
      sessionId: forkSessionId,
    }

    serializedMessages.push(serialized)
    lines.push(jsonStringify(forkedEntry))
    if (entry.type !== 'progress') {
      parentUuid = entry.uuid
    }
  }

  // 附加 content-replacement 条目（如果有），使用派生的 sessionId。
  // 写成单个条目（与 insertContentReplacement 相同的形状），以便
  // loadTranscriptFile 的 content-replacement 分支能获取到它。
  if (contentReplacementRecords.length > 0) {
    const forkedReplacementEntry: ContentReplacementEntry = {
      type: 'content-replacement',
      sessionId: forkSessionId,
      replacements: contentReplacementRecords,
    }
    lines.push(jsonStringify(forkedReplacementEntry))
  }

  // Write the fork session file
  await writeFile(forkSessionPath, lines.join('\n') + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  })

  return {
    sessionId: forkSessionId,
    title: customTitle,
    forkPath: forkSessionPath,
    serializedMessages,
    contentReplacementRecords,
  }
}

/**
 * 通过检查与现有会话名称的冲突来生成唯一的派生名称。
 * 如果 "baseName (Branch)" 已存在，则尝试 "baseName (Branch 2)"、"baseName (Branch 3)" 等。
 */
async function getUniqueForkName(baseName: string): Promise<string> {
  const candidateName = `${baseName} (派生)`

  // 检查此确切名称是否已存在
  const existingWithExactName = await searchSessionsByCustomTitle(
    candidateName,
    { exact: true },
  )

  if (existingWithExactName.length === 0) {
    return candidateName
  }

  // 名称冲突 - 查找唯一的编号后缀
  // 搜索所有以基础模式开头的会话
  const existingForks = await searchSessionsByCustomTitle(`${baseName} (派生`)

  // 提取现有的派生编号以找到下一个可用编号
  const usedNumbers = new Set<number>([1]) // 将 " (派生)" 视为编号 1
  const forkNumberPattern = new RegExp(
    `^${escapeRegExp(baseName)} \\(派生(?: (\\d+))?\\)$`,
  )

  for (const session of existingForks) {
    const match = session.customTitle?.match(forkNumberPattern)
    if (match) {
      if (match[1]) {
        usedNumbers.add(parseInt(match[1], 10))
      } else {
        usedNumbers.add(1) // " (派生)" 不带数字被视为 1
      }
    }
  }

  // 查找下一个可用编号
  let nextNumber = 2
  while (usedNumbers.has(nextNumber)) {
    nextNumber++
  }

  return `${baseName} (派生 ${nextNumber})`
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const customTitle = args?.trim() || undefined

  const originalSessionId = getSessionId()

  try {
    const {
      sessionId,
      title,
      forkPath,
      serializedMessages,
      contentReplacementRecords,
    } = await createFork(customTitle)

    // 构建用于恢复的 LogOption
    const now = new Date()
    const firstPrompt = deriveFirstPrompt(
      serializedMessages.find(m => m.type === 'user'),
    )

    // 保存自定义标题 - 使用提供的标题或 firstPrompt 作为默认值
    // 这确保 /status 和 /resume 显示相同的会话名称
    // 始终添加 " (派生)" 后缀以明确这是一个派生会话
    // 通过添加数字后缀处理冲突（例如 " (派生 2)"、" (派生 3)"）
    const baseName = title ?? firstPrompt
    const effectiveTitle = await getUniqueForkName(baseName)
    await saveCustomTitle(sessionId, effectiveTitle, forkPath)

    logEvent('tengu_conversation_forked', {
      message_count: serializedMessages.length,
      has_custom_title: !!title,
    })

    const forkLog: LogOption = {
      date: now.toISOString().split('T')[0]!,
      messages: serializedMessages,
      fullPath: forkPath,
      value: now.getTime(),
      created: now,
      modified: now,
      firstPrompt,
      messageCount: serializedMessages.length,
      isSidechain: false,
      sessionId,
      customTitle: effectiveTitle,
      contentReplacements: contentReplacementRecords,
    }

    // 恢复到派生会话
    const titleInfo = title ? ` "${title}"` : ''
    const resumeHint = `\n恢复原对话: claude -r ${originalSessionId}`
    const successMessage = `对话已派生${titleInfo}。您现在处于派生会话中。${resumeHint}`

    if (context.resume) {
      await context.resume(sessionId, forkLog, 'fork')
      onDone(successMessage, { display: 'system' })
    } else {
      // 如果恢复不可用，则回退
      onDone(
        `对话已派生${titleInfo}。恢复方式: /resume ${sessionId}`,
      )
    }

    return null
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '发生未知错误'
    onDone(`派生对话失败: ${message}`)
    return null
  }
}
