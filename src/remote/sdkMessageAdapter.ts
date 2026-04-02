import type {
  SDKAssistantMessage,
  SDKCompactBoundaryMessage,
  SDKMessage,
  SDKPartialAssistantMessage,
  SDKResultMessage,
  SDKStatusMessage,
  SDKSystemMessage,
  SDKToolProgressMessage,
} from '../entrypoints/agentSdkTypes.js'
import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemMessage,
} from '../types/message.js'
import { logForDebugging } from '../utils/debug.js'
import { fromSDKCompactMetadata } from '../utils/messages/mappers.js'
import { createUserMessage } from '../utils/messages.js'

/**
 * 将 CCR 的 SDKMessage 转换为 REPL Message 类型。
 *
 * CCR 后端通过 WebSocket 发送 SDK 格式的消息。REPL 期望
 * 内部 Message 类型进行渲染。此适配器连接两者。
 */

/**
 * 将 SDKAssistantMessage 转换为 AssistantMessage
 */
function convertAssistantMessage(msg: SDKAssistantMessage): AssistantMessage {
  return {
    type: 'assistant',
    message: msg.message,
    uuid: msg.uuid,
    requestId: undefined,
    timestamp: new Date().toISOString(),
    error: msg.error,
  }
}

/**
 * 将 SDKPartialAssistantMessage（流式）转换为 StreamEvent
 */
function convertStreamEvent(msg: SDKPartialAssistantMessage): StreamEvent {
  return {
    type: 'stream_event',
    event: msg.event,
  }
}

/**
 * 将 SDKResultMessage 转换为 SystemMessage
 */
function convertResultMessage(msg: SDKResultMessage): SystemMessage {
  const isError = msg.subtype !== 'success'
  const content = isError
    ? msg.errors?.join(', ') || '未知错误'
    : '会话成功完成'

  return {
    type: 'system',
    subtype: 'informational',
    content,
    level: isError ? 'warning' : 'info',
    uuid: msg.uuid,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 将 SDKSystemMessage（init）转换为 SystemMessage
 */
function convertInitMessage(msg: SDKSystemMessage): SystemMessage {
  return {
    type: 'system',
    subtype: 'informational',
    content: `远程会话已初始化（模型：${msg.model}）`,
    level: 'info',
    uuid: msg.uuid,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 将 SDKStatusMessage 转换为 SystemMessage
 */
function convertStatusMessage(msg: SDKStatusMessage): SystemMessage | null {
  if (!msg.status) {
    return null
  }

  return {
    type: 'system',
    subtype: 'informational',
    content:
      msg.status === 'compacting'
        ? '正在压缩对话…'
        : `状态：${msg.status}`,
    level: 'info',
    uuid: msg.uuid,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 将 SDKToolProgressMessage 转换为 SystemMessage。
 * 我们使用系统消息而不是 ProgressMessage，因为 Progress 类型
 * 是一个复杂的联合，需要我们从 CCR 没有的工具特定数据。
 */
function convertToolProgressMessage(
  msg: SDKToolProgressMessage,
): SystemMessage {
  return {
    type: 'system',
    subtype: 'informational',
    content: `工具 ${msg.tool_name} 已运行 ${msg.elapsed_time_seconds} 秒…`,
    level: 'info',
    uuid: msg.uuid,
    timestamp: new Date().toISOString(),
    toolUseID: msg.tool_use_id,
  }
}

/**
 * 将 SDKCompactBoundaryMessage 转换为 SystemMessage
 */
function convertCompactBoundaryMessage(
  msg: SDKCompactBoundaryMessage,
): SystemMessage {
  return {
    type: 'system',
    subtype: 'compact_boundary',
    content: '对话已压缩',
    level: 'info',
    uuid: msg.uuid,
    timestamp: new Date().toISOString(),
    compactMetadata: fromSDKCompactMetadata(msg.compact_metadata),
  }
}

/**
 * 转换 SDKMessage 的结果
 */
export type ConvertedMessage =
  | { type: 'message'; message: Message }
  | { type: 'stream_event'; event: StreamEvent }
  | { type: 'ignored' }

type ConvertOptions = {
  /** 将包含 tool_result 内容块的用户消息转换为 UserMessages。
   * 用于直连模式，工具结果来自远程服务器
   * 需要在本地渲染。CCR 模式忽略用户消息，
   * 因为它们的处理方式不同。 */
  convertToolResults?: boolean
  /**
   * 将用户文本消息转换为 UserMessages 以供显示。用于
   * 转换历史事件，其中用户输入的消息需要显示。
   * 在实时 WS 模式下，这些已由 REPL 在本地添加，
   * 因此默认情况下被忽略。
   */
  convertUserTextMessages?: boolean
}

/**
 * 将 SDKMessage 转换为 REPL 消息格式
 */
export function convertSDKMessage(
  msg: SDKMessage,
  opts?: ConvertOptions,
): ConvertedMessage {
  switch (msg.type) {
    case 'assistant':
      return { type: 'message', message: convertAssistantMessage(msg) }

    case 'user': {
      const content = msg.message?.content
      // 需要转换来自远程服务器的工具结果消息，以便
      // 它们像本地工具结果一样渲染和折叠。通过内容
      // 形状（tool_result 块）检测 — parent_tool_use_id 不可靠：
      // agent 端的 normalizeMessage() 顶级工具结果硬编码为 null，
      // 因此无法区分工具结果和提示回显。
      const isToolResult =
        Array.isArray(content) && content.some(b => b.type === 'tool_result')
      if (opts?.convertToolResults && isToolResult) {
        return {
          type: 'message',
          message: createUserMessage({
            content,
            toolUseResult: msg.tool_use_result,
            uuid: msg.uuid,
            timestamp: msg.timestamp,
          }),
        }
      }
      // 转换历史事件时，用户输入的消息需要
      // 渲染（它们没有由 REPL 在本地添加）。跳过 tool_results
      // 在这里 — 已在上面处理。
      if (opts?.convertUserTextMessages && !isToolResult) {
        if (typeof content === 'string' || Array.isArray(content)) {
          return {
            type: 'message',
            message: createUserMessage({
              content,
              toolUseResult: msg.tool_use_result,
              uuid: msg.uuid,
              timestamp: msg.timestamp,
            }),
          }
        }
      }
      // 用户输入的消息（字符串内容）已由 REPL 在本地添加。
      // 在 CCR 模式下，所有用户消息都被忽略（工具结果处理方式不同）。
      return { type: 'ignored' }
    }

    case 'stream_event':
      return { type: 'stream_event', event: convertStreamEvent(msg) }

    case 'result':
      // 只显示错误的结果消息。在多轮会话中成功结果
      // 是噪音（isLoading=false 是足够的信号）。
      if (msg.subtype !== 'success') {
        return { type: 'message', message: convertResultMessage(msg) }
      }
      return { type: 'ignored' }

    case 'system':
      if (msg.subtype === 'init') {
        return { type: 'message', message: convertInitMessage(msg) }
      }
      if (msg.subtype === 'status') {
        const statusMsg = convertStatusMessage(msg)
        return statusMsg
          ? { type: 'message', message: statusMsg }
          : { type: 'ignored' }
      }
      if (msg.subtype === 'compact_boundary') {
        return {
          type: 'message',
          message: convertCompactBoundaryMessage(msg),
        }
      }
      // hook_response 和其他子类型
      logForDebugging(
        `[sdkMessageAdapter] 忽略系统消息子类型：${msg.subtype}`,
      )
      return { type: 'ignored' }

    case 'tool_progress':
      return { type: 'message', message: convertToolProgressMessage(msg) }

    case 'auth_status':
      // 认证状态单独处理，不转换为显示消息
      logForDebugging('[sdkMessageAdapter] 忽略 auth_status 消息')
      return { type: 'ignored' }

    case 'tool_use_summary':
      // 工具使用摘要是 SDK 专用事件，不在 REPL 中显示
      logForDebugging('[sdkMessageAdapter] 忽略 tool_use_summary 消息')
      return { type: 'ignored' }

    case 'rate_limit_event':
      // 速率限制事件是 SDK 专用事件，不在 REPL 中显示
      logForDebugging('[sdkMessageAdapter] 忽略 rate_limit_event 消息')
      return { type: 'ignored' }

    default: {
      // 优雅地忽略未知消息类型。后端可能在
      // 客户端更新之前发送新类型；日志有助于调试
      // 而不会崩溃或丢失会话。
      logForDebugging(
        `[sdkMessageAdapter] 未知消息类型：${(msg as { type: string }).type}`,
      )
      return { type: 'ignored' }
    }
  }
}

/**
 * 检查 SDKMessage 是否表示会话已结束
 */
export function isSessionEndMessage(msg: SDKMessage): boolean {
  return msg.type === 'result'
}

/**
 * 检查 SDKResultMessage 是否表示成功
 */
export function isSuccessResult(msg: SDKResultMessage): boolean {
  return msg.subtype === 'success'
}

/**
 * 从成功的 SDKResultMessage 中提取结果文本
 */
export function getResultText(msg: SDKResultMessage): string | null {
  if (msg.subtype === 'success') {
    return msg.result
  }
  return null
}
