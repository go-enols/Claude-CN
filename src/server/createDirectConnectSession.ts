/* eslint-disable eslint-plugin-n/no-unsupported-features/node-builtins */

import { errorMessage } from '../utils/errors.js'
import { jsonStringify } from '../utils/slowOperations.js'
import type { DirectConnectConfig } from './directConnectManager.js'
import { connectResponseSchema } from './types.js'

/**
 * 连接失败时 createDirectConnectSession 抛出的错误。
 */
export class DirectConnectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DirectConnectError'
  }
}

/**
 * 在直连服务器上创建会话。
 *
 * 发送 POST 请求到 `${serverUrl}/sessions`，验证响应，并返回
 * 供 REPL 或无头运行器使用的 DirectConnectConfig。
 *
 * 发生网络、HTTP 或响应解析失败时抛出 DirectConnectError。
 */
export async function createDirectConnectSession({
  serverUrl,
  authToken,
  cwd,
  dangerouslySkipPermissions,
}: {
  serverUrl: string
  authToken?: string
  cwd: string
  dangerouslySkipPermissions?: boolean
}): Promise<{
  config: DirectConnectConfig
  workDir?: string
}> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (authToken) {
    headers['authorization'] = `Bearer ${authToken}`
  }

  let resp: Response
  try {
    resp = await fetch(`${serverUrl}/sessions`, {
      method: 'POST',
      headers,
      body: jsonStringify({
        cwd,
        ...(dangerouslySkipPermissions && {
          dangerously_skip_permissions: true,
        }),
      }),
    })
  } catch (err) {
    throw new DirectConnectError(
      `无法连接到 ${serverUrl} 处的服务器：${errorMessage(err)}`,
    )
  }

  if (!resp.ok) {
    throw new DirectConnectError(
      `创建会话失败：${resp.status} ${resp.statusText}`,
    )
  }

  const result = connectResponseSchema().safeParse(await resp.json())
  if (!result.success) {
    throw new DirectConnectError(
      `无效的会话响应：${result.error.message}`,
    )
  }

  const data = result.data
  return {
    config: {
      serverUrl,
      sessionId: data.session_id,
      wsUrl: data.ws_url,
      authToken,
    },
    workDir: data.work_dir,
  }
}
