import { randomUUID } from 'crypto'
import type { SDKControlPermissionRequest } from '../entrypoints/sdk/controlTypes.js'
import type { Tool } from '../Tool.js'
import type { AssistantMessage } from '../types/message.js'
import { jsonStringify } from '../utils/slowOperations.js'

/**
 * 为远程权限请求创建合成的 AssistantMessage。
 * ToolUseConfirm 类型需要 AssistantMessage，但在远程模式下
 * 我们没有真正的消息 —— 工具使用在 CCR 容器上运行。
 */
export function createSyntheticAssistantMessage(
  request: SDKControlPermissionRequest,
  requestId: string,
): AssistantMessage {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    message: {
      id: `remote-${requestId}`,
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: request.tool_use_id,
          name: request.tool_name,
          input: request.input,
        },
      ],
      model: '',
      stop_reason: null,
      stop_sequence: null,
      container: null,
      context_management: null,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    } as AssistantMessage['message'],
    requestId: undefined,
    timestamp: new Date().toISOString(),
  }
}

/**
 * 为本地未加载的工具创建最小的 Tool 存根。
 * 当远程 CCR 有本地 CLI 不知道的工具（如 MCP 工具）时会发生这种情况。
 * 存根路由到 FallbackPermissionRequest。
 */
export function createToolStub(toolName: string): Tool {
  return {
    name: toolName,
    inputSchema: {} as Tool['inputSchema'],
    isEnabled: () => true,
    userFacingName: () => toolName,
    renderToolUseMessage: (input: Record<string, unknown>) => {
      const entries = Object.entries(input)
      if (entries.length === 0) return ''
      return entries
        .slice(0, 3)
        .map(([key, value]) => {
          const valueStr =
            typeof value === 'string' ? value : jsonStringify(value)
          return `${key}: ${valueStr}`
        })
        .join(', ')
    },
    call: async () => ({ data: '' }),
    description: async () => '',
    prompt: () => '',
    isReadOnly: () => false,
    isMcp: false,
    needsPermissions: () => true,
  } as unknown as Tool
}
