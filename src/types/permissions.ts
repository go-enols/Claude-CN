/**
 * 纯权限类型定义，提取出来以打破导入循环。
 *
 * 此文件仅包含类型定义和常量，没有运行时依赖。
 * 实现文件保留在 src/utils/permissions/ 中，但可以从这里导入
 * 以避免循环依赖。
 */

import { feature } from 'bun:bundle'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'

// ============================================================================
// Permission Modes
// ============================================================================

export const EXTERNAL_PERMISSION_MODES = [
  'acceptEdits',
  'bypassPermissions',
  'default',
  'dontAsk',
  'plan',
] as const

export type ExternalPermissionMode = (typeof EXTERNAL_PERMISSION_MODES)[number]

// 详尽的模式联合，用于类型检查。用户可寻址的运行时集合
// 是下面的 INTERNAL_PERMISSION_MODES。
export type InternalPermissionMode = ExternalPermissionMode | 'auto' | 'bubble'
export type PermissionMode = InternalPermissionMode

// 运行时验证集合：用户可寻址的模式（settings.json
// defaultMode、--permission-mode CLI 标志、会话恢复）。
export const INTERNAL_PERMISSION_MODES = [
  ...EXTERNAL_PERMISSION_MODES,
  ...(feature('TRANSCRIPT_CLASSIFIER') ? (['auto'] as const) : ([] as const)),
] as const satisfies readonly PermissionMode[]

export const PERMISSION_MODES = INTERNAL_PERMISSION_MODES

// ============================================================================
// Permission Behaviors
// ============================================================================

export type PermissionBehavior = 'allow' | 'deny' | 'ask'

// ============================================================================
// Permission Rules
// ============================================================================

/**
 * 权限规则来自哪里。
 * 包含所有 SettingSource 值以及额外的规则特定来源。
 */
export type PermissionRuleSource =
  | 'userSettings'
  | 'projectSettings'
  | 'localSettings'
  | 'flagSettings'
  | 'policySettings'
  | 'cliArg'
  | 'command'
  | 'session'

/**
 * 权限规则的值 - 指定哪个工具和可选内容
 */
export type PermissionRuleValue = {
  toolName: string
  ruleContent?: string
}

/**
 * 具有其来源和行为的权限规则
 */
export type PermissionRule = {
  source: PermissionRuleSource
  ruleBehavior: PermissionBehavior
  ruleValue: PermissionRuleValue
}

// ============================================================================
// Permission Updates
// ============================================================================

/**
 * 权限更新应该持久化到哪里
 */
export type PermissionUpdateDestination =
  | 'userSettings'
  | 'projectSettings'
  | 'localSettings'
  | 'session'
  | 'cliArg'

/**
 * 权限配置的操作更新
 */
export type PermissionUpdate =
  | {
      type: 'addRules'
      destination: PermissionUpdateDestination
      rules: PermissionRuleValue[]
      behavior: PermissionBehavior
    }
  | {
      type: 'replaceRules'
      destination: PermissionUpdateDestination
      rules: PermissionRuleValue[]
      behavior: PermissionBehavior
    }
  | {
      type: 'removeRules'
      destination: PermissionUpdateDestination
      rules: PermissionRuleValue[]
      behavior: PermissionBehavior
    }
  | {
      type: 'setMode'
      destination: PermissionUpdateDestination
      mode: ExternalPermissionMode
    }
  | {
      type: 'addDirectories'
      destination: PermissionUpdateDestination
      directories: string[]
    }
  | {
      type: 'removeDirectories'
      destination: PermissionUpdateDestination
      directories: string[]
    }

/**
 * 额外工作目录权限的来源。
 * 注意：目前这与 PermissionRuleSource 相同，但保留为
 * 单独的类型以提高语义清晰度和未来可能的分化。
 */
export type WorkingDirectorySource = PermissionRuleSource

/**
 * 包含在权限范围内的额外目录
 */
export type AdditionalWorkingDirectory = {
  path: string
  source: WorkingDirectorySource
}

// ============================================================================
// Permission Decisions & Results
// ============================================================================

/**
 * 权限元数据的最小命令形状。
 * 这是 full Command 类型的子集，以避免导入循环。
 * 仅包含权限相关组件需要的属性。
 */
export type PermissionCommandMetadata = {
  name: string
  description?: string
  // 允许附加属性以向前兼容
  [key: string]: unknown
}

/**
 * 附加到权限决策的元数据
 */
export type PermissionMetadata =
  | { command: PermissionCommandMetadata }
  | undefined

/**
 * 权限被授予时的结果
 */
export type PermissionAllowDecision<
  Input extends { [key: string]: unknown } = { [key: string]: unknown },
> = {
  behavior: 'allow'
  updatedInput?: Input
  userModified?: boolean
  decisionReason?: PermissionDecisionReason
  toolUseID?: string
  acceptFeedback?: string
  contentBlocks?: ContentBlockParam[]
}

/**
 * 将异步运行的待定分类器检查的元数据。
 * 用于启用非阻塞允许分类器评估。
 */
export type PendingClassifierCheck = {
  command: string
  cwd: string
  descriptions: string[]
}

/**
 * 应该提示用户时的结果
 */
export type PermissionAskDecision<
  Input extends { [key: string]: unknown } = { [key: string]: unknown },
> = {
  behavior: 'ask'
  message: string
  updatedInput?: Input
  decisionReason?: PermissionDecisionReason
  suggestions?: PermissionUpdate[]
  blockedPath?: string
  metadata?: PermissionMetadata
  /**
   * 如果为 true，此 ask 决策是由 bashCommandIs 安全检查触发的
   * 针对 splitCommand 可能会错误解析的模式（例如，行延续、shell-quote
   * 转换）。由 bashToolHasPermission 在 splitCommand
   * 转换命令之前提前阻止。未为简单的换行符复合命令设置。
   */
  isBashSecurityCheckForMisparsing?: boolean
  /**
   * 如果设置，应该异步运行允许分类器检查。
   * 分类器可以在用户响应之前自动批准权限。
   */
  pendingClassifierCheck?: PendingClassifierCheck
  /**
   * 可选的内容块（例如，图像）以与拒绝消息一起包含在工具结果中。
   * 当用户粘贴图像作为反馈时使用。
   */
  contentBlocks?: ContentBlockParam[]
}

/**
 * 权限被拒绝时的结果
 */
export type PermissionDenyDecision = {
  behavior: 'deny'
  message: string
  decisionReason: PermissionDecisionReason
  toolUseID?: string
}

/**
 * 权限决策 - 允许、询问或拒绝
 */
export type PermissionDecision<
  Input extends { [key: string]: unknown } = { [key: string]: unknown },
> =
  | PermissionAllowDecision<Input>
  | PermissionAskDecision<Input>
  | PermissionDenyDecision

/**
 * 具有额外 passthrough 选项的权限结果
 */
export type PermissionResult<
  Input extends { [key: string]: unknown } = { [key: string]: unknown },
> =
  | PermissionDecision<Input>
  | {
      behavior: 'passthrough'
      message: string
      decisionReason?: PermissionDecision<Input>['decisionReason']
      suggestions?: PermissionUpdate[]
      blockedPath?: string
      /**
       * 如果设置，应该异步运行允许分类器检查。
       * 分类器可以在用户响应之前自动批准权限。
       */
      pendingClassifierCheck?: PendingClassifierCheck
    }

/**
 * 权限决策原因的解释
 */
export type PermissionDecisionReason =
  | {
      type: 'rule'
      rule: PermissionRule
    }
  | {
      type: 'mode'
      mode: PermissionMode
    }
  | {
      type: 'subcommandResults'
      reasons: Map<string, PermissionResult>
    }
  | {
      type: 'permissionPromptTool'
      permissionPromptToolName: string
      toolResult: unknown
    }
  | {
      type: 'hook'
      hookName: string
      hookSource?: string
      reason?: string
    }
  | {
      type: 'asyncAgent'
      reason: string
    }
  | {
      type: 'sandboxOverride'
      reason: 'excludedCommand' | 'dangerouslyDisableSandbox'
    }
  | {
      type: 'classifier'
      classifier: string
      reason: string
    }
  | {
      type: 'workingDir'
      reason: string
    }
  | {
      type: 'safetyCheck'
      reason: string
      // 如果为 true，auto 模式让分类器评估这个而不是
      // 强制提示。对于敏感文件路径（.claude/、.git/、
      // shell configs）为 true — 分类器可以看到上下文并决定。
      // 对于 Windows 路径绕过尝试和跨机器桥接消息为 false。
      classifierApprovable: boolean
    }
  | {
      type: 'other'
      reason: string
    }

// ============================================================================
// Bash 分类器类型
// ============================================================================

export type ClassifierResult = {
  matches: boolean
  matchedDescription?: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

export type ClassifierBehavior = 'deny' | 'ask' | 'allow'

export type ClassifierUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export type YoloClassifierResult = {
  thinking?: string
  shouldBlock: boolean
  reason: string
  unavailable?: boolean
  /**
   * API 返回"prompt is too long" — 分类器记录超过了
   * 上下文窗口。确定性的（相同记录 → 相同错误），所以
   * 调用者应该回退到正常提示而不是重试/失败关闭。
   */
  transcriptTooLong?: boolean
  /** 此次分类器调用使用的模型 */
  model: string
  /** 分类器 API 调用的 token 使用量（用于开销遥测） */
  usage?: ClassifierUsage
  /** 分类器 API 调用的持续时间（毫秒） */
  durationMs?: number
  /** 发送给分类器的提示组件的字符长度 */
  promptLengths?: {
    systemPrompt: number
    toolCalls: number
    userPrompts: number
  }
  /** 错误提示被转储的路径（仅在因 API 错误不可用时设置） */
  errorDumpPath?: string
  /** 哪个分类器阶段产生了最终决策（仅 2 阶段 XML） */
  stage?: 'fast' | 'thinking'
  /** 第 1 阶段（fast）的 token 使用量（当也运行第 2 阶段时） */
  stage1Usage?: ClassifierUsage
  /** 当也运行第 2 阶段时，第 1 阶段的持续时间（毫秒） */
  stage1DurationMs?: number
  /**
   * 第 1 阶段的 API request_id（req_xxx）。支持连接到服务器端
   * api_usage 日志以进行缓存未命中/路由归属。也用于
   * 传统的 1 阶段（tool_use）分类器 — 单个请求进入此处。
   */
  stage1RequestId?: string
  /**
   * 第 1 阶段的 API message id（msg_xxx）。支持将
   * tengu_auto_mode_decision 分析事件连接到分类器在
   * 后期分析中的实际提示/完成。
   */
  stage1MsgId?: string
  /** 当运行第 2 阶段（thinking）时，第 2 阶段的 token 使用量 */
  stage2Usage?: ClassifierUsage
  /** 当运行第 2 阶段时，第 2 阶段的持续时间（毫秒） */
  stage2DurationMs?: number
  /** 第 2 阶段的 API request_id（只要第 2 阶段运行就设置） */
  stage2RequestId?: string
  /** 第 2 阶段的 API message id（msg_xxx）（只要第 2 阶段运行就设置） */
  stage2MsgId?: string
}

// ============================================================================
// 权限解释器类型
// ============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export type PermissionExplanation = {
  riskLevel: RiskLevel
  explanation: string
  reasoning: string
  risk: string
}

// ============================================================================
// Tool Permission Context
// ============================================================================

/**
 * 按来源划分的权限规则映射
 */
export type ToolPermissionRulesBySource = {
  [T in PermissionRuleSource]?: string[]
}

/**
 * 工具中权限检查所需的上下文
 * 注意：对此类型唯一的文件使用简化的 DeepImmutable 近似
 */
export type ToolPermissionContext = {
  readonly mode: PermissionMode
  readonly additionalWorkingDirectories: ReadonlyMap<
    string,
    AdditionalWorkingDirectory
  >
  readonly alwaysAllowRules: ToolPermissionRulesBySource
  readonly alwaysDenyRules: ToolPermissionRulesBySource
  readonly alwaysAskRules: ToolPermissionRulesBySource
  readonly isBypassPermissionsModeAvailable: boolean
  readonly strippedDangerousRules?: ToolPermissionRulesBySource
  readonly shouldAvoidPermissionPrompts?: boolean
  readonly awaitAutomatedChecksBeforeDialog?: boolean
  readonly prePlanMode?: PermissionMode
}
