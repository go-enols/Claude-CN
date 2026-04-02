import type { SDKMessage } from '../entrypoints/agentSdkTypes.js'
import type {
  SDKControlCancelRequest,
  SDKControlPermissionRequest,
  SDKControlRequest,
  SDKControlResponse,
} from '../entrypoints/sdk/controlTypes.js'
import { logForDebugging } from '../utils/debug.js'
import { logError } from '../utils/log.js'
import {
  type RemoteMessageContent,
  sendEventToRemoteSession,
} from '../utils/teleport/api.js'
import {
  SessionsWebSocket,
  type SessionsWebSocketCallbacks,
} from './SessionsWebSocket.js'

/**
 * 类型守卫，检查消息是否为 SDKMessage（而非控制消息）
 */
function isSDKMessage(
  message:
    | SDKMessage
    | SDKControlRequest
    | SDKControlResponse
    | SDKControlCancelRequest,
): message is SDKMessage {
  return (
    message.type !== 'control_request' &&
    message.type !== 'control_response' &&
    message.type !== 'control_cancel_request'
  )
}

/**
 * 远程会话的简单权限响应。
 * 这是用于 CCR 通信的简化版 PermissionResult。
 */
export type RemotePermissionResponse =
  | {
      behavior: 'allow'
      updatedInput: Record<string, unknown>
    }
  | {
      behavior: 'deny'
      message: string
    }

export type RemoteSessionConfig = {
  sessionId: string
  getAccessToken: () => string
  orgUuid: string
  /** 如果会话是使用正在处理的初始提示创建的，则为 true */
  hasInitialPrompt?: boolean
  /**
   * 为 true 时，此客户端为纯查看器。Ctrl+C/Escape 不会向
   * 远程代理发送中断；60秒重连超时被禁用；
   * 不会更新会话标题。供 `claude assistant` 使用。
   */
  viewerOnly?: boolean
}

export type RemoteSessionCallbacks = {
  /** 从会话收到 SDKMessage 时调用 */
  onMessage: (message: SDKMessage) => void
  /** 从 CCR 收到权限请求时调用 */
  onPermissionRequest: (
    request: SDKControlPermissionRequest,
    requestId: string,
  ) => void
  /** 服务器取消待处理的权限请求时调用 */
  onPermissionCancelled?: (
    requestId: string,
    toolUseId: string | undefined,
  ) => void
  /** 连接建立时调用 */
  onConnected?: () => void
  /** 连接丢失且无法恢复时调用 */
  onDisconnected?: () => void
  /** 暂时断开 WS 且正在重连时调用 */
  onReconnecting?: () => void
  /** 发生错误时调用 */
  onError?: (error: Error) => void
}

/**
 * 管理远程 CCR 会话。
 *
 * 协调：
 * - 用于从 CCR 接收消息的 WebSocket 订阅
 * - 用于向 CCR 发送用户消息的 HTTP POST
 * - 权限请求/响应流程
 */
export class RemoteSessionManager {
  private websocket: SessionsWebSocket | null = null
  private pendingPermissionRequests: Map<string, SDKControlPermissionRequest> =
    new Map()

  constructor(
    private readonly config: RemoteSessionConfig,
    private readonly callbacks: RemoteSessionCallbacks,
  ) {}

  /**
   * 通过 WebSocket 连接到远程会话
   */
  connect(): void {
    logForDebugging(
      `[RemoteSessionManager] 正在连接到会话 ${this.config.sessionId}`,
    )

    const wsCallbacks: SessionsWebSocketCallbacks = {
      onMessage: message => this.handleMessage(message),
      onConnected: () => {
        logForDebugging('[RemoteSessionManager] 已连接')
        this.callbacks.onConnected?.()
      },
      onClose: () => {
        logForDebugging('[RemoteSessionManager] 已断开连接')
        this.callbacks.onDisconnected?.()
      },
      onReconnecting: () => {
        logForDebugging('[RemoteSessionManager] 正在重连')
        this.callbacks.onReconnecting?.()
      },
      onError: error => {
        logError(error)
        this.callbacks.onError?.(error)
      },
    }

    this.websocket = new SessionsWebSocket(
      this.config.sessionId,
      this.config.orgUuid,
      this.config.getAccessToken,
      wsCallbacks,
    )

    void this.websocket.connect()
  }

  /**
   * 处理来自 WebSocket 的消息
   */
  private handleMessage(
    message:
      | SDKMessage
      | SDKControlRequest
      | SDKControlResponse
      | SDKControlCancelRequest,
  ): void {
    // 处理控制请求（来自 CCR 的权限提示）
    if (message.type === 'control_request') {
      this.handleControlRequest(message)
      return
    }

    // 处理控制取消请求（服务器取消待处理的权限提示）
    if (message.type === 'control_cancel_request') {
      const { request_id } = message
      const pendingRequest = this.pendingPermissionRequests.get(request_id)
      logForDebugging(
        `[RemoteSessionManager] 权限请求已取消：${request_id}`,
      )
      this.pendingPermissionRequests.delete(request_id)
      this.callbacks.onPermissionCancelled?.(
        request_id,
        pendingRequest?.tool_use_id,
      )
      return
    }

    // 处理控制响应（确认）
    if (message.type === 'control_response') {
      logForDebugging('[RemoteSessionManager] 收到控制响应')
      return
    }

    // 转发 SDK 消息到回调（类型守卫确保正确收窄）
    if (isSDKMessage(message)) {
      this.callbacks.onMessage(message)
    }
  }

  /**
   * 处理来自 CCR 的控制请求（如权限请求）
   */
  private handleControlRequest(request: SDKControlRequest): void {
    const { request_id, request: inner } = request

    if (inner.subtype === 'can_use_tool') {
      logForDebugging(
        `[RemoteSessionManager] 工具权限请求：${inner.tool_name}`,
      )
      this.pendingPermissionRequests.set(request_id, inner)
      this.callbacks.onPermissionRequest(inner, request_id)
    } else {
      // 为无法识别的子类型发送错误响应，以免服务器
      // 等待永远不会到来的回复而挂起。
      logForDebugging(
        `[RemoteSessionManager] 不支持的控制请求子类型：${inner.subtype}`,
      )
      const response: SDKControlResponse = {
        type: 'control_response',
        response: {
          subtype: 'error',
          request_id,
          error: `不支持的控制请求子类型：${inner.subtype}`,
        },
      }
      this.websocket?.sendControlResponse(response)
    }
  }

  /**
   * 通过 HTTP POST 向远程会话发送用户消息
   */
  async sendMessage(
    content: RemoteMessageContent,
    opts?: { uuid?: string },
  ): Promise<boolean> {
    logForDebugging(
      `[RemoteSessionManager] 正在向会话发送消息 ${this.config.sessionId}`,
    )

    const success = await sendEventToRemoteSession(
      this.config.sessionId,
      content,
      opts,
    )

    if (!success) {
      logError(
        new Error(
          `[RemoteSessionManager] 无法向会话发送消息 ${this.config.sessionId}`,
        ),
      )
    }

    return success
  }

  /**
   * 响应来自 CCR 的权限请求
   */
  respondToPermissionRequest(
    requestId: string,
    result: RemotePermissionResponse,
  ): void {
    const pendingRequest = this.pendingPermissionRequests.get(requestId)
    if (!pendingRequest) {
      logError(
        new Error(
          `[RemoteSessionManager] 没有待处理的权限请求，ID：${requestId}`,
        ),
      )
      return
    }

    this.pendingPermissionRequests.delete(requestId)

    const response: SDKControlResponse = {
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: {
          behavior: result.behavior,
          ...(result.behavior === 'allow'
            ? { updatedInput: result.updatedInput }
            : { message: result.message }),
        },
      },
    }

    logForDebugging(
      `[RemoteSessionManager] 发送权限响应：${result.behavior}`,
    )

    this.websocket?.sendControlResponse(response)
  }

  /**
   * 检查是否已连接到远程会话
   */
  isConnected(): boolean {
    return this.websocket?.isConnected() ?? false
  }

  /**
   * 发送中断信号以取消远程会话上的当前请求
   */
  cancelSession(): void {
    logForDebugging('[RemoteSessionManager] 正在发送中断信号')
    this.websocket?.sendControlRequest({ subtype: 'interrupt' })
  }

  /**
   * 获取会话 ID
   */
  getSessionId(): string {
    return this.config.sessionId
  }

  /**
   * 断开与远程会话的连接
   */
  disconnect(): void {
    logForDebugging('[RemoteSessionManager] 正在断开连接')
    this.websocket?.close()
    this.websocket = null
    this.pendingPermissionRequests.clear()
  }

  /**
   * 强制重连 WebSocket。
   * 容器关闭后订阅变得陈旧时很有用。
   */
  reconnect(): void {
    logForDebugging('[RemoteSessionManager] 正在重连 WebSocket')
    this.websocket?.reconnect()
  }
}

/**
 * 从 OAuth 令牌创建远程会话配置
 */
export function createRemoteSessionConfig(
  sessionId: string,
  getAccessToken: () => string,
  orgUuid: string,
  hasInitialPrompt = false,
  viewerOnly = false,
): RemoteSessionConfig {
  return {
    sessionId,
    getAccessToken,
    orgUuid,
    hasInitialPrompt,
    viewerOnly,
  }
}
