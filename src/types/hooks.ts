// biome-ignore-all assist/source/organizeImports: ANT-ONLY import markers must not be reordered
import { z } from 'zod/v4'
import { lazySchema } from '../utils/lazySchema.js'
import {
  type HookEvent,
  HOOK_EVENTS,
  type HookInput,
  type PermissionUpdate,
} from 'src/entrypoints/agentSdkTypes.js'
import type {
  HookJSONOutput,
  AsyncHookJSONOutput,
  SyncHookJSONOutput,
} from 'src/entrypoints/agentSdkTypes.js'
import type { Message } from 'src/types/message.js'
import type { PermissionResult } from 'src/utils/permissions/PermissionResult.js'
import { permissionBehaviorSchema } from 'src/utils/permissions/PermissionRule.js'
import { permissionUpdateSchema } from 'src/utils/permissions/PermissionUpdateSchema.js'
import type { AppState } from '../state/AppState.js'
import type { AttributionState } from '../utils/commitAttribution.js'

export function isHookEvent(value: string): value is HookEvent {
  return HOOK_EVENTS.includes(value as HookEvent)
}

// Prompt 获取协议类型。`prompt` 键作为判别器
//（模仿 {async:true} 模式），其值为 id。
export const promptRequestSchema = lazySchema(() =>
  z.object({
    prompt: z.string(), // request id
    message: z.string(),
    options: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        description: z.string().optional(),
      }),
    ),
  }),
)

export type PromptRequest = z.infer<ReturnType<typeof promptRequestSchema>>

export type PromptResponse = {
  prompt_response: string // request id
  selected: string
}

// 同步 hook 响应模式
export const syncHookResponseSchema = lazySchema(() =>
  z.object({
    continue: z
      .boolean()
      .describe('Hook 执行后 Claude 是否应继续（默认：true）')
      .optional(),
    suppressOutput: z
      .boolean()
      .describe('从记录中隐藏 stdout（默认：false）')
      .optional(),
    stopReason: z
      .string()
      .describe('continue 为 false 时显示的消息')
      .optional(),
    decision: z.enum(['approve', 'block']).optional(),
    reason: z.string().describe('决策说明').optional(),
    systemMessage: z
      .string()
      .describe('向用户显示的警告消息')
      .optional(),
    hookSpecificOutput: z
      .union([
        z.object({
          hookEventName: z.literal('PreToolUse'),
          permissionDecision: permissionBehaviorSchema().optional(),
          permissionDecisionReason: z.string().optional(),
          updatedInput: z.record(z.string(), z.unknown()).optional(),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('UserPromptSubmit'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('SessionStart'),
          additionalContext: z.string().optional(),
          initialUserMessage: z.string().optional(),
          watchPaths: z
            .array(z.string())
            .describe('用于 FileChanged hook 的绝对路径')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('Setup'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('SubagentStart'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('PostToolUse'),
          additionalContext: z.string().optional(),
          updatedMCPToolOutput: z
            .unknown()
            .describe('更新 MCP 工具的输出')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('PostToolUseFailure'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('PermissionDenied'),
          retry: z.boolean().optional(),
        }),
        z.object({
          hookEventName: z.literal('Notification'),
          additionalContext: z.string().optional(),
        }),
        z.object({
          hookEventName: z.literal('PermissionRequest'),
          decision: z.union([
            z.object({
              behavior: z.literal('allow'),
              updatedInput: z.record(z.string(), z.unknown()).optional(),
              updatedPermissions: z.array(permissionUpdateSchema()).optional(),
            }),
            z.object({
              behavior: z.literal('deny'),
              message: z.string().optional(),
              interrupt: z.boolean().optional(),
            }),
          ]),
        }),
        z.object({
          hookEventName: z.literal('Elicitation'),
          action: z.enum(['accept', 'decline', 'cancel']).optional(),
          content: z.record(z.string(), z.unknown()).optional(),
        }),
        z.object({
          hookEventName: z.literal('ElicitationResult'),
          action: z.enum(['accept', 'decline', 'cancel']).optional(),
          content: z.record(z.string(), z.unknown()).optional(),
        }),
        z.object({
          hookEventName: z.literal('CwdChanged'),
          watchPaths: z
            .array(z.string())
            .describe('用于 FileChanged hook 的绝对路径')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('FileChanged'),
          watchPaths: z
            .array(z.string())
            .describe('用于 FileChanged hook 的绝对路径')
            .optional(),
        }),
        z.object({
          hookEventName: z.literal('WorktreeCreate'),
          worktreePath: z.string(),
        }),
      ])
      .optional(),
  }),
)

// Zod 模式，用于 hook JSON 输出验证
export const hookJSONOutputSchema = lazySchema(() => {
  // 异步 hook 响应模式
  const asyncHookResponseSchema = z.object({
    async: z.literal(true),
    asyncTimeout: z.number().optional(),
  })
  return z.union([asyncHookResponseSchema, syncHookResponseSchema()])
})

// 从模式推断 TypeScript 类型
type SchemaHookJSONOutput = z.infer<ReturnType<typeof hookJSONOutputSchema>>

// 类型守卫函数，检查响应是否为同步
export function isSyncHookJSONOutput(
  json: HookJSONOutput,
): json is SyncHookJSONOutput {
  return !('async' in json && json.async === true)
}

// 类型守卫函数，检查响应是否为异步
export function isAsyncHookJSONOutput(
  json: HookJSONOutput,
): json is AsyncHookJSONOutput {
  return 'async' in json && json.async === true
}

// 编译时断言，SDK 和 Zod 类型匹配
import type { IsEqual } from 'type-fest'
type Assert<T extends true> = T
type _assertSDKTypesMatch = Assert<
  IsEqual<SchemaHookJSONOutput, HookJSONOutput>
>

/** 传递给回调 hook 的上下文，用于状态访问 */
export type HookCallbackContext = {
  getAppState: () => AppState
  updateAttributionState: (
    updater: (prev: AttributionState) => AttributionState,
  ) => void
}

/** 作为回调的 Hook。 */
export type HookCallback = {
  type: 'callback'
  callback: (
    input: HookInput,
    toolUseID: string | null,
    abort: AbortSignal | undefined,
    /** 用于 SessionStart hook 计算 CLAUDE_ENV_FILE 路径的 hook 索引 */
    hookIndex?: number,
    /** 用于访问应用状态的可选上下文 */
    context?: HookCallbackContext,
  ) => Promise<HookJSONOutput>
  /** 此 hook 的超时时间（秒） */
  timeout?: number
  /** 内部 hook（例如会话文件访问分析）不包括在 tengu_run_hook 指标中 */
  internal?: boolean
}

export type HookCallbackMatcher = {
  matcher?: string
  hooks: HookCallback[]
  pluginName?: string
}

export type HookProgress = {
  type: 'hook_progress'
  hookEvent: HookEvent
  hookName: string
  command: string
  promptText?: string
  statusMessage?: string
}

export type HookBlockingError = {
  blockingError: string
  command: string
}

export type PermissionRequestResult =
  | {
      behavior: 'allow'
      updatedInput?: Record<string, unknown>
      updatedPermissions?: PermissionUpdate[]
    }
  | {
      behavior: 'deny'
      message?: string
      interrupt?: boolean
    }

export type HookResult = {
  message?: Message
  systemMessage?: Message
  blockingError?: HookBlockingError
  outcome: 'success' | 'blocking' | 'non_blocking_error' | 'cancelled'
  preventContinuation?: boolean
  stopReason?: string
  permissionBehavior?: 'ask' | 'deny' | 'allow' | 'passthrough'
  hookPermissionDecisionReason?: string
  additionalContext?: string
  initialUserMessage?: string
  updatedInput?: Record<string, unknown>
  updatedMCPToolOutput?: unknown
  permissionRequestResult?: PermissionRequestResult
  retry?: boolean
}

export type AggregatedHookResult = {
  message?: Message
  blockingErrors?: HookBlockingError[]
  preventContinuation?: boolean
  stopReason?: string
  hookPermissionDecisionReason?: string
  permissionBehavior?: PermissionResult['behavior']
  additionalContexts?: string[]
  initialUserMessage?: string
  updatedInput?: Record<string, unknown>
  updatedMCPToolOutput?: unknown
  permissionRequestResult?: PermissionRequestResult
  retry?: boolean
}
