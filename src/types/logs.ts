import type { UUID } from 'crypto'
import type { FileHistorySnapshot } from 'src/utils/fileHistory.js'
import type { ContentReplacementRecord } from 'src/utils/toolResultStorage.js'
import type { AgentId } from './ids.js'
import type { Message } from './message.js'
import type { QueueOperationMessage } from './messageQueueTypes.js'

export type SerializedMessage = Message & {
  cwd: string
  userType: string
  entrypoint?: string // CLAUDE_CODE_ENTRYPOINT — 区分 cli/sdk-ts/sdk-py/etc.
  sessionId: string
  timestamp: string
  version: string
  gitBranch?: string
  slug?: string // 计划等文件的会话别名（用于恢复）
}

export type LogOption = {
  date: string
  messages: SerializedMessage[]
  fullPath?: string
  value: number
  created: Date
  modified: Date
  firstPrompt: string
  messageCount: number
  fileSize?: number // 文件大小（字节，用于显示）
  isSidechain: boolean
  isLite?: boolean // 轻量日志为 true（消息未加载）
  sessionId?: string // 轻量日志的会话 ID
  teamName?: string // 如果是生成的代理会话，则为团队名称
  agentName?: string // 代理的自定义名称（来自 /rename 或 swarm）
  agentColor?: string // 代理的颜色（来自 /rename 或 swarm）
  agentSetting?: string // 使用的代理定义（来自 --agent 标志或 settings.agent）
  isTeammate?: boolean // 此会话是否由 swarm 队友创建
  leafUuid?: UUID // 如果给出，此 uuid 必须出现在数据库中
  summary?: string // 可选的会话摘要
  customTitle?: string // 可选的用户自定义标题
  tag?: string // 会话的可选标签（在 /resume 中可搜索）
  fileHistorySnapshots?: FileHistorySnapshot[] // 可选的文件历史快照
  attributionSnapshots?: AttributionSnapshotMessage[] // 可选的归属快照
  contextCollapseCommits?: ContextCollapseCommitEntry[] // 有序 — 提交 B 可能引用提交 A 的摘要
  contextCollapseSnapshot?: ContextCollapseSnapshotEntry // 最后胜出 — 暂存队列 + 生成状态
  gitBranch?: string // 会话结束时的 Git 分支
  projectPath?: string // 原始项目目录路径
  prNumber?: number // 链接到此会话的 GitHub PR 编号
  prUrl?: string // 链接 PR 的完整 URL
  prRepository?: string // 仓库格式为 "owner/repo"
  mode?: 'coordinator' | 'normal' // 协调器/普通检测的会话模式
  worktreeSession?: PersistedWorktreeSession | null // 会话结束时的 worktree 状态（null = 已退出，undefined = 从未进入）
  contentReplacements?: ContentReplacementRecord[] // 恢复重建的替换决策
}

export type SummaryMessage = {
  type: 'summary'
  leafUuid: UUID
  summary: string
}

export type CustomTitleMessage = {
  type: 'custom-title'
  sessionId: UUID
  customTitle: string
}

/**
 * AI 生成的会话标题。与 CustomTitleMessage 区分开来，这样：
 * - 用户重命名（custom-title）在读取偏好上始终优先于 AI 标题
 * - reAppendSessionHistory 永远不会重新附加 AI 标题（它们是临时的/
 *   可重新生成的；重新附加会在恢复时覆盖用户重命名）
 * - VS Code 的 onlyIfNoCustomTitle CAS 检查仅匹配用户标题，
 *   允许 AI 覆盖自己之前的 AI 标题，但不能覆盖用户标题
 */
export type AiTitleMessage = {
  type: 'ai-title'
  sessionId: UUID
  aiTitle: string
}

export type LastPromptMessage = {
  type: 'last-prompt'
  sessionId: UUID
  lastPrompt: string
}

/**
 * 定期分叉生成的代理当前正在做什么的摘要。
 * 每隔 min(5 步, 2 分钟) 在回合中间分叉主线程写入，
 * 以便 `claude ps` 可以显示比最后用户提示更有用的内容
 *（通常是"好的走吧"或"修复它"）。
 */
export type TaskSummaryMessage = {
  type: 'task-summary'
  sessionId: UUID
  summary: string
  timestamp: string
}

export type TagMessage = {
  type: 'tag'
  sessionId: UUID
  tag: string
}

export type AgentNameMessage = {
  type: 'agent-name'
  sessionId: UUID
  agentName: string
}

export type AgentColorMessage = {
  type: 'agent-color'
  sessionId: UUID
  agentColor: string
}

export type AgentSettingMessage = {
  type: 'agent-setting'
  sessionId: UUID
  agentSetting: string
}

/**
 * 存储在会话记录中的 PR 链接消息。
 * 将会话链接到 GitHub pull request 以进行跟踪和导航。
 */
export type PRLinkMessage = {
  type: 'pr-link'
  sessionId: UUID
  prNumber: number
  prUrl: string
  prRepository: string // 例如，"owner/repo"
  timestamp: string // 链接时的 ISO 时间戳
}

export type ModeEntry = {
  type: 'mode'
  sessionId: UUID
  mode: 'coordinator' | 'normal'
}

/**
 * 为恢复而持久化到记录中的 worktree 会话状态。
 * WorktreeSession 的子集（来自 utils/worktree.ts）— 排除临时
 * 字段（creationDurationMs、usedSparsePaths），这些仅用于
 * 首次运行分析。
 */
export type PersistedWorktreeSession = {
  originalCwd: string
  worktreePath: string
  worktreeName: string
  worktreeBranch?: string
  originalBranch?: string
  originalHeadCommit?: string
  sessionId: string
  tmuxSessionName?: string
  hookBased?: boolean
}

/**
 * 记录会话当前是否在由 EnterWorktree 或 --worktree 创建的 worktree 中。
 * 最后胜出：进入时写入会话，退出时写入 null。恢复时，仅在 worktreePath
 * 仍然存在于磁盘上时才恢复（/exit 对话框可能已将其删除）。
 */
export type WorktreeStateEntry = {
  type: 'worktree-state'
  sessionId: UUID
  worktreeSession: PersistedWorktreeSession | null
}

/**
 * 记录其上下文表示被替换为较小存根的内容块
 *（完整内容已持久化到其他地方）。恢复时重放以保持提示缓存稳定。
 * 每次替换至少一个块的强制执行通道写入一次。设置 agentId 时，
 * 记录属于子代理 sidechain（AgentTool 恢复读取这些）；不存在时，
 * 为主线程（/resume 读取这些）。
 */
export type ContentReplacementEntry = {
  type: 'content-replacement'
  sessionId: UUID
  agentId?: AgentId
  replacements: ContentReplacementRecord[]
}

export type FileHistorySnapshotMessage = {
  type: 'file-history-snapshot'
  messageId: UUID
  snapshot: FileHistorySnapshot
  isSnapshotUpdate: boolean
}

/**
 * 追踪 Claude 字符贡献的每个文件归属状态。
 */
export type FileAttributionState = {
  contentHash: string // 文件内容的 SHA-256 哈希
  claudeContribution: number // Claude 编写的字符数
  mtime: number // 文件修改时间
}

/**
 * 存储在会话记录中的归属快照消息。
 * 追踪 Claude 的字符级贡献以进行提交归属。
 */
export type AttributionSnapshotMessage = {
  type: 'attribution-snapshot'
  messageId: UUID
  surface: string // 客户端界面（cli, ide, web, api）
  fileStates: Record<string, FileAttributionState>
  promptCount?: number // 会话中的总提示数
  promptCountAtLastCommit?: number // 上次提交时的提示数
  permissionPromptCount?: number // 显示的权限提示总数
  permissionPromptCountAtLastCommit?: number // 上次提交时的权限提示数
  escapeCount?: number // 总 ESC 按键次数（取消的权限提示）
  escapeCountAtLastCommit?: number // 上次提交时的 ESC 按键次数
}

export type TranscriptMessage = SerializedMessage & {
  parentUuid: UUID | null
  logicalParentUuid?: UUID | null // 当 parentUuid 为会话中断而 null 时保留逻辑父级
  isSidechain: boolean
  gitBranch?: string
  agentId?: string // 用于恢复代理的 sidechain 记录的代理 ID
  teamName?: string // 如果是生成的代理会话，则为团队名称
  agentName?: string // 代理的自定义名称（来自 /rename 或 swarm）
  agentColor?: string // 代理的颜色（来自 /rename 或 swarm）
  promptId?: string // 与用户提示消息的 OTel prompt.id 相关联
}

export type SpeculationAcceptMessage = {
  type: 'speculation-accept'
  timestamp: string
  timeSavedMs: number
}

/**
 * 持久化的上下文折叠提交。归档的消息本身不会
 * 持久化——它们已经在记录中作为普通的用户/
 * 助手消息。我们仅持久化足够的内容来重建拼接
 * 指令（边界 uuid）和摘要占位符（不在记录中，
 * 因为它从未对 REPL 产生）。
 *
 * 恢复时，存储使用 archived=[] 重建 CommittedCollapse；
 * projectView 在首次找到该跨度时惰性填充归档。
 *
 * 判别器被混淆以匹配门名称。sessionStorage.ts
 * 不是功能门控的（它是每个条目类型使用的通用记录管道），
 * 因此这里的描述性字符串会通过 appendEntry 分发 /
 * loadTranscriptFile 解析器泄漏到外部构建中，即使
 * 外部构建中没有任何内容写入或读取此条目。
 */
export type ContextCollapseCommitEntry = {
  type: 'marble-origami-commit'
  sessionId: UUID
  /** 16 位折叠 ID。跨条目的最大值重置 ID 计数器。 */
  collapseId: string
  /** 摘要占位符的 uuid — registerSummary() 需要它。 */
  summaryUuid: string
  /** 完整的 <collapsed id="...">text</collapsed> 字符串用于占位符。 */
  summaryContent: string
  /** 用于 ctx_inspect 的纯摘要文本。 */
  summary: string
  /** 跨度边界 — projectView 在恢复的 Message[] 中找到这些。 */
  firstArchivedUuid: string
  lastArchivedUuid: string
}

/**
 * 暂存队列和生成触发器状态的快照。与提交不同
 *（仅附加，重放全部），快照是最后胜出 — 恢复时仅应用
 * 最近的快照条目。每次 ctx-agent 生成解析后写入
 *（当暂存内容可能已更改时）。
 *
 * 暂存边界是 uuid（会话稳定），而不是折叠 ID（随
 * uuidToId bimap 重置）。恢复暂存跨度会在下次
 * 装饰/显示时为那些消息生成新的折叠 ID，但跨度
 * 本身会正确解析。
 */
export type ContextCollapseSnapshotEntry = {
  type: 'marble-origami-snapshot'
  sessionId: UUID
  staged: Array<{
    startUuid: string
    endUuid: string
    summary: string
    risk: number
    stagedAt: number
  }>
  /** 生成触发器状态 — 以便 +interval 时钟从上次离开的地方继续。 */
  armed: boolean
  lastSpawnTokens: number
}

export type Entry =
  | TranscriptMessage
  | SummaryMessage
  | CustomTitleMessage
  | AiTitleMessage
  | LastPromptMessage
  | TaskSummaryMessage
  | TagMessage
  | AgentNameMessage
  | AgentColorMessage
  | AgentSettingMessage
  | PRLinkMessage
  | FileHistorySnapshotMessage
  | AttributionSnapshotMessage
  | QueueOperationMessage
  | SpeculationAcceptMessage
  | ModeEntry
  | WorktreeStateEntry
  | ContentReplacementEntry
  | ContextCollapseCommitEntry
  | ContextCollapseSnapshotEntry

export function sortLogs(logs: LogOption[]): LogOption[] {
  return logs.sort((a, b) => {
    // 按修改日期排序（最新的在前）
    const modifiedDiff = b.modified.getTime() - a.modified.getTime()
    if (modifiedDiff !== 0) {
      return modifiedDiff
    }

    // 如果修改日期相同，按创建日期排序（最新的在前）
    return b.created.getTime() - a.created.getTime()
  })
}
