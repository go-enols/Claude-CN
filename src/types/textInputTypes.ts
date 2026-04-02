import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { UUID } from 'crypto'
import type React from 'react'
import type { PermissionResult } from '../entrypoints/agentSdkTypes.js'
import type { Key } from '../ink.js'
import type { PastedContent } from '../utils/config.js'
import type { ImageDimensions } from '../utils/imageResizer.js'
import type { TextHighlight } from '../utils/textHighlighting.js'
import type { AgentId } from './ids.js'
import type { AssistantMessage, MessageOrigin } from './message.js'

/**
 * 输入中命令自动补全的嵌入式幽灵文本
 */
export type InlineGhostText = {
  /** 要显示的幽灵文本（例如，"mit" 表示 /commit） */
  readonly text: string
  /** 完整命令名称（例如，"commit"） */
  readonly fullCommand: string
  /** 幽灵文本应该出现的输入位置 */
  readonly insertPosition: number
}

/**
 * 文本输入组件的基础 props
 */
export type BaseTextInputProps = {
  /**
   * 处理在输入开头按上箭头时历史导航的可选回调
   */
  readonly onHistoryUp?: () => void

  /**
   * 处理在输入结尾按下箭头时历史导航的可选回调
   */
  readonly onHistoryDown?: () => void

  /**
   * 当 `value` 为空时要显示的文本。
   */
  readonly placeholder?: string

  /**
   * 允许通过反斜杠换行进行多行输入（默认：`true`）
   */
  readonly multiline?: boolean

  /**
   * 监听用户输入。在有多个输入组件同时存在的情况下很有用，
   * 输入必须"路由"到特定组件。
   */
  readonly focus?: boolean

  /**
   * 替换所有字符并遮罩值。用于密码输入。
   */
  readonly mask?: string

  /**
   * 是否显示光标并允许使用箭头键在文本输入内导航。
   */
  readonly showCursor?: boolean

  /**
   * 高亮粘贴的文本
   */
  readonly highlightPastedText?: boolean

  /**
   * 文本输入中显示的值。
   */
  readonly value: string

  /**
   * 值更新时调用的函数。
   */
  readonly onChange: (value: string) => void

  /**
   * 按下 `Enter` 时调用的函数，第一个参数是输入的值。
   */
  readonly onSubmit?: (value: string) => void

  /**
   * 按下 Ctrl+C 退出时调用的函数。
   */
  readonly onExit?: () => void

  /**
   * 显示退出消息的可选回调
   */
  readonly onExitMessage?: (show: boolean, key?: string) => void

  /**
   * 显示自定义消息的可选回调
   */
  // readonly onMessage?: (show: boolean, message?: string) => void

  /**
   * 重置历史位置的可选回调
   */
  readonly onHistoryReset?: () => void

  /**
   * 输入被清除时的可选回调（例如，双重转义）
   */
  readonly onClearInput?: () => void

  /**
   * 文本换行的列数
   */
  readonly columns: number

  /**
   * 输入视口的可见最大行数。当换行后的输入
   * 超过此行数时，仅渲染光标周围的行。
   */
  readonly maxVisibleLines?: number

  /**
   * 粘贴图像时的可选回调
   */
  readonly onImagePaste?: (
    base64Image: string,
    mediaType?: string,
    filename?: string,
    dimensions?: ImageDimensions,
    sourcePath?: string,
  ) => void

  /**
   * 粘贴大文本（超过 800 字符）时的可选回调
   */
  readonly onPaste?: (text: string) => void

  /**
   * 粘贴状态更改时的回调
   */
  readonly onIsPastingChange?: (isPasting: boolean) => void

  /**
   * 是否禁用上/下箭头键的光标移动
   */
  readonly disableCursorMovementForUpDownKeys?: boolean

  /**
   * 跳过文本级双击转义处理程序。在按键绑定上下文（例如 Autocomplete）
   * 拥有转义时设置 — 键绑定的 stopImmediatePropagation 无法保护文本输入，
   * 因为子效果在父效果之前注册 useInput 侦听器。
   */
  readonly disableEscapeDoublePress?: boolean

  /**
   * 文本中光标的偏移量
   */
  readonly cursorOffset: number

  /**
   * 设置光标偏移量的回调
   */
  onChangeCursorOffset: (offset: number) => void

  /**
   * 命令输入后显示的可选提示文本
   * 用于显示命令的可用参数
   */
  readonly argumentHint?: string

  /**
   * 撤销功能的可选回调
   */
  readonly onUndo?: () => void

  /**
   * 是否以暗淡颜色渲染文本
   */
  readonly dimColor?: boolean

  /**
   * 搜索结果或其他高亮的可选文本高亮
   */
  readonly highlights?: TextHighlight[]

  /**
   * 渲染为占位符的可选自定义 React 元素。
   * 提供时，覆盖标准 `placeholder` 字符串渲染。
   */
  readonly placeholderElement?: React.ReactNode

  /**
   * 输入中命令自动补全的可选嵌入式幽灵文本
   */
  readonly inlineGhostText?: InlineGhostText

  /**
   * 键路由前应用于原始输入的可选过滤器。返回
   *（可能转换的）输入字符串；对非空输入返回 ''
   * 会丢弃该事件。
   */
  readonly inputFilter?: (input: string, key: Key) => string
}

/**
 * VimTextInput 的扩展 props
 */
export type VimTextInputProps = BaseTextInputProps & {
  /**
   * 使用的初始 vim 模式
   */
  readonly initialMode?: VimMode

  /**
   * 模式更改的可选回调
   */
  readonly onModeChange?: (mode: VimMode) => void
}

/**
 * Vim 编辑器模式
 */
export type VimMode = 'INSERT' | 'NORMAL'

/**
 * 输入钩子结果的通用属性
 */
export type BaseInputState = {
  onInput: (input: string, key: Key) => void
  renderedValue: string
  offset: number
  setOffset: (offset: number) => void
  /** 渲染文本中的光标行（0 索引），考虑换行。 */
  cursorLine: number
  /** 当前行中的光标列（显示宽度）。 */
  cursorColumn: number
  /** 视口开始的字符偏移（无窗口化时为 0）。 */
  viewportCharOffset: number
  /** 视口结束的字符偏移（无窗口化时为 text.length）。 */
  viewportCharEnd: number

  // 用于粘贴处理
  isPasting?: boolean
  pasteState?: {
    chunks: string[]
    timeoutId: ReturnType<typeof setTimeout> | null
  }
}

/**
 * 文本输入的状态
 */
export type TextInputState = BaseInputState

/**
 * 带模式的 vim 输入状态
 */
export type VimInputState = BaseInputState & {
  mode: VimMode
  setMode: (mode: VimMode) => void
}

/**
 * 提示的输入模式
 */
export type PromptInputMode =
  | 'bash'
  | 'prompt'
  | 'orphaned-permission'
  | 'task-notification'

export type EditablePromptInputMode = Exclude<
  PromptInputMode,
  `${string}-notification`
>

/**
 * 队列优先级。在正常和主动模式下语义相同。
 *
 *  - `now`   — 中断并立即发送。中止任何正在进行的工具
 *              调用（相当于 Esc + 发送）。消费者（print.ts，
 *              REPL.tsx）订阅队列更改并在看到 'now' 命令时中止。
 *  - `next`  — 中途排出。让当前工具调用完成，然后
 *              在工具结果和下一个 API 往返之间发送此消息。
 *              唤醒正在进行的 SleepTool 调用。
 *  - `later` — 回合末排出。等待当前回合完成，
 *              然后作为新查询处理。唤醒正在进行的 SleepTool
 *              调用（query.ts 在 sleep 后升级排出阈值，
 *              因此消息附加到同一回合）。
 *
 * SleepTool 仅在主动模式下可用，因此在正常模式下"唤醒 SleepTool"
 * 是无操作。
 */
export type QueuePriority = 'now' | 'next' | 'later'

/**
 * 队列命令类型
 */
export type QueuedCommand = {
  value: string | Array<ContentBlockParam>
  mode: PromptInputMode
  /** 入队时默认为 `mode` 隐含的优先级。 */
  priority?: QueuePriority
  uuid?: UUID
  orphanedPermission?: OrphanedPermission
  /** 包含图像的原始粘贴内容。图像在执行时调整大小。 */
  pastedContents?: Record<number, PastedContent>
  /**
   * 展开 [粘贴的文本 #N] 占位符之前的输入字符串。
   * 用于 ultraplan 关键字检测，以便包含关键字的粘贴内容
   * 不会触发 CCR 会话。未设置时回退到 `value`
   *（bridge/UDS/MCP 源没有粘贴展开）。
   */
  preExpansionValue?: string
  /**
   * 当为 true 时，即使输入以 `/` 开头，也被视为纯文本。
   * 用于远程接收的消息（例如 bridge/CCR），不应
   * 触发本地斜杠命令或技能。
   */
  skipSlashCommands?: boolean
  /**
   * 当为 true 时，斜杠命令被分派但通过
   * isBridgeSafeCommand() 过滤 — 'local-jsx' 和仅终端命令返回
   * 有用的错误而不是执行。由远程控制桥接
   * 入站路径设置，以便移动/网络客户端可以运行技能和良性命令，
   * 而不会重新暴露 PR #19134 错误（/model 弹出本地选择器）。
   */
  bridgeOrigin?: boolean
  /**
   * 当为 true 时，生成的 UserMessage 获得 `isMeta: true` — 在
   * 记录 UI 中隐藏但模型可见。用于通过队列路由的
   * 系统生成提示（主动 tick、队友消息、资源更新）而不是
   * 直接调用 `onQuery`。
   */
  isMeta?: boolean
  /**
   * 此命令的来源。盖在生成的 UserMessage 上，以便
   * 记录从结构上记录来源（而不仅仅是内容中的 XML 标签）。
   * undefined = 人类（键盘）。
   */
  origin?: MessageOrigin
  /**
   * 工作负载标签，贯穿到 cc_workload= 在计费头
   * 归属块中。队列是 cron 调度程序触发和回合实际运行之间的
   * 异步边界 — 用户提示可能会滑入其中 — 所以标签
   * 骑在 QueuedCommand 本身上，仅在此命令出队时
   * 才被提升到引导状态。
   */
  workload?: string
  /**
   * 应该接收此通知的代理。undefined = 主线程。
   * 子代理在进程内运行并共享模块级命令队列；query.ts 中的
   * 排出门按此字段过滤，以便子代理的后台任务
   * 通知不会泄漏到协调器的上下文（PR #18453
   * 统一了队列，但失去了双队列偶然具有的隔离）。
   */
  agentId?: AgentId
}

/**
 * 具有非空数据的图像 PastedContent 的类型守卫。空内容
 * 图像（例如，来自 0 字节文件拖动）产生空的 base64 字符串，
 * API 会拒绝"图像不能为空"。在每个将 PastedContent → ImageBlockParam
 * 的站点使用此函数，以保持过滤器和 ID 列表同步。
 */
export function isValidImagePaste(c: PastedContent): boolean {
  return c.type === 'image' && c.content.length > 0
}

/** 从 QueuedCommand 的 pastedContents 中提取图像粘贴 ID。 */
export function getImagePasteIds(
  pastedContents: Record<number, PastedContent> | undefined,
): number[] | undefined {
  if (!pastedContents) {
    return undefined
  }
  const ids = Object.values(pastedContents)
    .filter(isValidImagePaste)
    .map(c => c.id)
  return ids.length > 0 ? ids : undefined
}

export type OrphanedPermission = {
  permissionResult: PermissionResult
  assistantMessage: AssistantMessage
}
