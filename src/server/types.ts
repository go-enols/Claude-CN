import type { ChildProcess } from 'child_process'
import { z } from 'zod/v4'
import { lazySchema } from '../utils/lazySchema.js'

export const connectResponseSchema = lazySchema(() =>
  z.object({
    session_id: z.string(),
    ws_url: z.string(),
    work_dir: z.string().optional(),
  }),
)

export type ServerConfig = {
  port: number
  host: string
  authToken: string
  unix?: string
  /** 分离会话的空闲超时（毫秒）。0 = 永不过期。 */
  idleTimeoutMs?: number
  /** 最大并发会话数。 */
  maxSessions?: number
  /** 未指定 cwd 的会话的默认工作区目录。 */
  workspace?: string
}

export type SessionState =
  | 'starting'
  | 'running'
  | 'detached'
  | 'stopping'
  | 'stopped'

export type SessionInfo = {
  id: string
  status: SessionState
  createdAt: number
  workDir: string
  process: ChildProcess | null
  sessionKey?: string
}

/**
 * 稳定的会话键 → 会话元数据。持久化到 ~/.claude/server-sessions.json
 * 以便在服务器重启后恢复会话。
 */
export type SessionIndexEntry = {
  /** 服务器分配的会话 ID（匹配子进程的 claude 会话）。 */
  sessionId: string
  /** 用于 --resume 的 claude 转录会话 ID。对于直接会话，与 sessionId 相同。 */
  transcriptSessionId: string
  cwd: string
  permissionMode?: string
  createdAt: number
  lastActiveAt: number
}

export type SessionIndex = Record<string, SessionIndexEntry>
