import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { UUID } from 'crypto'
import type { CanUseToolFn } from '../hooks/useCanUseTool.js'
import type { CompactionResult } from '../services/compact/compact.js'
import type { ScopedMcpServerConfig } from '../services/mcp/types.js'
import type { ToolUseContext } from '../Tool.js'
import type { EffortValue } from '../utils/effort.js'
import type { IDEExtensionInstallationStatus, IdeType } from '../utils/ide.js'
import type { SettingSource } from '../utils/settings/constants.js'
import type { HooksSettings } from '../utils/settings/types.js'
import type { ThemeName } from '../utils/theme.js'
import type { LogOption } from './logs.js'
import type { Message } from './message.js'
import type { PluginManifest } from './plugin.js'

export type LocalCommandResult =
  | { type: 'text'; value: string }
  | {
      type: 'compact'
      compactionResult: CompactionResult
      displayText?: string
    }
  | { type: 'skip' } // 跳过消息

export type PromptCommand = {
  type: 'prompt'
  progressMessage: string
  contentLength: number // Length of command content in characters (used for token estimation)
  argNames?: string[]
  allowedTools?: string[]
  model?: string
  source: SettingSource | 'builtin' | 'mcp' | 'plugin' | 'bundled'
  pluginInfo?: {
    pluginManifest: PluginManifest
    repository: string
  }
  disableNonInteractive?: boolean
  // Hooks to register when this skill is invoked
  hooks?: HooksSettings
  // Base directory for skill resources (used to set CLAUDE_PLUGIN_ROOT environment variable for skill hooks)
  skillRoot?: string
  // Execution context: 'inline' (default) or 'fork' (run as sub-agent)
  // 'inline' = skill content expands into the current conversation
  // 'fork' = skill runs in a sub-agent with separate context and token budget
  context?: 'inline' | 'fork'
  // Agent type to use when forked (e.g., 'Bash', 'general-purpose')
  // Only applicable when context is 'fork'
  agent?: string
  effort?: EffortValue
  // Glob patterns for file paths this skill applies to
  // When set, the skill is only visible after the model touches matching files
  paths?: string[]
  getPromptForCommand(
    args: string,
    context: ToolUseContext,
  ): Promise<ContentBlockParam[]>
}

/**
 * 本地命令实现的调用签名。
 */
export type LocalCommandCall = (
  args: string,
  context: LocalJSXCommandContext,
) => Promise<LocalCommandResult>

/**
 * load() 返回的模块形状，用于延迟加载的本地命令。
 */
export type LocalCommandModule = {
  call: LocalCommandCall
}

type LocalCommand = {
  type: 'local'
  supportsNonInteractive: boolean
  load: () => Promise<LocalCommandModule>
}

export type LocalJSXCommandContext = ToolUseContext & {
  canUseTool?: CanUseToolFn
  setMessages: (updater: (prev: Message[]) => Message[]) => void
  options: {
    dynamicMcpConfig?: Record<string, ScopedMcpServerConfig>
    ideInstallationStatus: IDEExtensionInstallationStatus | null
    theme: ThemeName
  }
  onChangeAPIKey: () => void
  onChangeDynamicMcpConfig?: (
    config: Record<string, ScopedMcpServerConfig>,
  ) => void
  onInstallIDEExtension?: (ide: IdeType) => void
  resume?: (
    sessionId: UUID,
    log: LogOption,
    entrypoint: ResumeEntrypoint,
  ) => Promise<void>
}

export type ResumeEntrypoint =
  | 'cli_flag'
  | 'slash_command_picker'
  | 'slash_command_session_id'
  | 'slash_command_title'
  | 'fork'

export type CommandResultDisplay = 'skip' | 'system' | 'user'

/**
 * 命令完成时的回调。
 * @param result - 可选的用户可见消息
 * @param options - 命令完成的可选配置
 * @param options.display - 如何显示结果：'skip' | 'system' | 'user'（默认）
 * @param options.shouldQuery - 如果为 true，命令完成后向模型发送消息
 * @param options.metaMessages - 额外插入为 isMeta 的消息（模型可见但隐藏）
 */
export type LocalJSXCommandOnDone = (
  result?: string,
  options?: {
    display?: CommandResultDisplay
    shouldQuery?: boolean
    metaMessages?: string[]
    nextInput?: string
    submitNextInput?: boolean
  },
) => void

/**
 * 本地 JSX 命令实现的调用签名。
 */
export type LocalJSXCommandCall = (
  onDone: LocalJSXCommandOnDone,
  context: ToolUseContext & LocalJSXCommandContext,
  args: string,
) => Promise<React.ReactNode>

/**
 * load() 返回的模块形状，用于延迟加载的命令。
 */
export type LocalJSXCommandModule = {
  call: LocalJSXCommandCall
}

type LocalJSXCommand = {
  type: 'local-jsx'
  /**
   * Lazy-load the command implementation.
   * Returns a module with a call() function.
   * This defers loading heavy dependencies until the command is invoked.
   */
  load: () => Promise<LocalJSXCommandModule>
}

/**
 * 声明命令在哪些认证/提供商环境中可用。
 *
 * 这与 `isEnabled()` 是分开的：
 *   - `availability` = 谁可以使用这个命令（认证/提供商要求，静态）
 *   - `isEnabled()`  = 当前是否启用（GrowthBook、平台、环境变量）
 *
 * 没有 `availability` 的命令在任何地方都可用。
 * 有 `availability` 的命令只在用户匹配至少列出的认证类型之一时才显示。
 * 参见 commands.ts 中的 meetsAvailabilityRequirement()。
 *
 * 示例：`availability: ['claude-ai', 'console']` 向 claude.ai 订阅者和
 * 直接使用 Console API 密钥的用户（api.anthropic.com）显示该命令，
 * 但对 Bedrock/Vertex/Foundry 用户和自定义 base URL 用户隐藏。
 */
export type CommandAvailability =
    // claude.ai OAuth 订阅者（通过 claude.ai 的 Pro/Max/Team/Enterprise）
  | 'claude-ai'
  // Console API 密钥用户（直接使用 api.anthropic.com，非通过 claude.ai OAuth）
  | 'console'

export type CommandBase = {
  availability?: CommandAvailability[]
  description: string
  hasUserSpecifiedDescription?: boolean
  /** 默认为 true。仅在命令有条件启用（功能标志、环境检查等）时设置。 */
  isEnabled?: () => boolean
  /** 默认为 false。仅在命令应从 typeahead/帮助中隐藏时设置。 */
  isHidden?: boolean
  name: string
  aliases?: string[]
  isMcp?: boolean
  argumentHint?: string // 命令参数的提示文本（在命令后以灰色显示）
  whenToUse?: string // 来自"Skill"规范。详细的使用场景
  version?: string // 命令/技能的版本
  disableModelInvocation?: boolean // 是否禁用模型调用此命令
  userInvocable?: boolean // 用户是否可以通过输入 /skill-name 来调用此技能
  loadedFrom?:
    | 'commands_DEPRECATED'
    | 'skills'
    | 'plugin'
    | 'managed'
    | 'bundled'
    | 'mcp' // 命令加载来源
  kind?: 'workflow' // 区分由工作流支持的命令（在自动完成中显示徽章）
  immediate?: boolean // 如果为 true，命令会立即执行而不等待停止点（绕过队列）
  isSensitive?: boolean // 如果为 true，参数将从会话历史中删除
  /** 默认为 `name`。仅在显示名称不同时覆盖（例如插件前缀剥离）。 */
  userFacingName?: () => string
}

export type Command = CommandBase &
  (PromptCommand | LocalCommand | LocalJSXCommand)

/** 解析用户可见名称，未覆盖时回退到 `cmd.name`。 */
export function getCommandName(cmd: CommandBase): string {
  return cmd.userFacingName?.() ?? cmd.name
}

/** 解析命令是否启用，默认为 true。 */
export function isCommandEnabled(cmd: CommandBase): boolean {
  return cmd.isEnabled?.() ?? true
}
