import { DEFAULT_BINDINGS } from '../../keybindings/defaultBindings.js'
import { isKeybindingCustomizationEnabled } from '../../keybindings/loadUserBindings.js'
import {
  MACOS_RESERVED,
  NON_REBINDABLE,
  TERMINAL_RESERVED,
} from '../../keybindings/reservedShortcuts.js'
import type { KeybindingsSchemaType } from '../../keybindings/schema.js'
import {
  KEYBINDING_ACTIONS,
  KEYBINDING_CONTEXT_DESCRIPTIONS,
  KEYBINDING_CONTEXTS,
} from '../../keybindings/schema.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { registerBundledSkill } from '../bundledSkills.js'

/**
 * 构建所有上下文的 markdown 表格。
 */
function generateContextsTable(): string {
  return markdownTable(
    ['上下文', '描述'],
    KEYBINDING_CONTEXTS.map(ctx => [
      `\`${ctx}\``,
      KEYBINDING_CONTEXT_DESCRIPTIONS[ctx],
    ]),
  )
}

/**
 * 构建所有操作的 markdown 表格，包括其默认绑定和上下文。
 */
function generateActionsTable(): string {
  // 构建查找：action -> { keys, context }
  const actionInfo: Record<string, { keys: string[]; context: string }> = {}
  for (const block of DEFAULT_BINDINGS) {
    for (const [key, action] of Object.entries(block.bindings)) {
      if (action) {
        if (!actionInfo[action]) {
          actionInfo[action] = { keys: [], context: block.context }
        }
        actionInfo[action].keys.push(key)
      }
    }
  }

  return markdownTable(
    ['操作', '默认键', '上下文'],
    KEYBINDING_ACTIONS.map(action => {
      const info = actionInfo[action]
      const keys = info ? info.keys.map(k => `\`${k}\``).join(', ') : '（无）'
      const context = info ? info.context : inferContextFromAction(action)
      return [`\`${action}\``, keys, context]
    }),
  )
}

/**
 * 当不在 DEFAULT_BINDINGS 中时，从操作前缀推断上下文。
 */
function inferContextFromAction(action: string): string {
  const prefix = action.split(':')[0]
  const prefixToContext: Record<string, string> = {
    app: '全局',
    history: '全局或聊天',
    chat: '聊天',
    autocomplete: '自动完成',
    confirm: '确认',
    tabs: '标签页',
    transcript: '记录',
    historySearch: '历史搜索',
    task: '任务',
    theme: '主题选择器',
    help: '帮助',
    attachments: '附件',
    footer: '页脚',
    messageSelector: '消息选择器',
    diff: '差异对话框',
    modelPicker: '模型选择器',
    select: '选择',
    permission: '确认',
  }
  return prefixToContext[prefix ?? ''] ?? '未知'
}

/**
 * 构建保留快捷键列表。
 */
function generateReservedShortcuts(): string {
  const lines: string[] = []

  lines.push('### 不可重新绑定（错误）')
  for (const s of NON_REBINDABLE) {
    lines.push(`- \`${s.key}\` — ${s.reason}`)
  }

  lines.push('')
  lines.push('### 终端保留（错误/警告）')
  for (const s of TERMINAL_RESERVED) {
    lines.push(
      `- \`${s.key}\` — ${s.reason}（${s.severity === 'error' ? '将无法工作' : '可能冲突'}）`,
    )
  }

  lines.push('')
  lines.push('### macOS 保留（错误）')
  for (const s of MACOS_RESERVED) {
    lines.push(`- \`${s.key}\` — ${s.reason}`)
  }

  return lines.join('\n')
}

const FILE_FORMAT_EXAMPLE: KeybindingsSchemaType = {
  $schema: 'https://www.schemastore.org/claude-code-keybindings.json',
  $docs: 'https://code.claude.com/docs/en/keybindings',
  bindings: [
    {
      context: 'Chat',
      bindings: {
        'ctrl+e': 'chat:externalEditor',
      },
    },
  ],
}

const UNBIND_EXAMPLE: KeybindingsSchemaType['bindings'][number] = {
  context: 'Chat',
  bindings: {
    'ctrl+s': null,
  },
}

const REBIND_EXAMPLE: KeybindingsSchemaType['bindings'][number] = {
  context: 'Chat',
  bindings: {
    'ctrl+g': null,
    'ctrl+e': 'chat:externalEditor',
  },
}

const CHORD_EXAMPLE: KeybindingsSchemaType['bindings'][number] = {
  context: 'Global',
  bindings: {
    'ctrl+k ctrl+t': 'app:toggleTodos',
  },
}

const SECTION_INTRO = [
  '# 快捷键技能',
  '',
  '创建或修改 `~/.claude/keybindings.json` 以自定义键盘快捷键。',
  '',
  '## 重要：写入前先阅读',
  '',
  '**始终先读取 `~/.claude/keybindings.json`**（它可能尚不存在）。将更改与现有绑定合并 — 永远不要替换整个文件。',
  '',
  '- 使用 **Edit** 工具修改现有文件',
  '- 仅在文件尚不存在时使用 **Write** 工具',
].join('\n')

const SECTION_FILE_FORMAT = [
  '## 文件格式',
  '',
  '```json',
  jsonStringify(FILE_FORMAT_EXAMPLE, null, 2),
  '```',
  '',
  '始终包含 `$schema` 和 `$docs` 字段。',
].join('\n')

const SECTION_KEYSTROKE_SYNTAX = [
  '## 按键语法',
  '',
  '**修饰符**（用 `+` 组合）：',
  '- `ctrl`（别名：`control`）',
  '- `alt`（别名：`opt`、`option`）— 注意：在终端中 `alt` 和 `meta` 是相同的',
  '- `shift`',
  '- `meta`（别名：`cmd`、`command`）',
  '',
  '**特殊键**：`escape`/`esc`、`enter`/`return`、`tab`、`space`、`backspace`、`delete`、`up`、`down`、`left`、`right`',
  '',
  '**和弦**：空格分隔的按键，例如 `ctrl+k ctrl+s`（按键之间 1 秒超时）',
  '',
  '**示例**：`ctrl+shift+p`、`alt+enter`、`ctrl+k ctrl+n`',
].join('\n')

const SECTION_UNBINDING = [
  '## 取消绑定默认快捷键',
  '',
  '将键设置为 `null` 以移除其默认绑定：',
  '',
  '```json',
  jsonStringify(UNBIND_EXAMPLE, null, 2),
  '```',
].join('\n')

const SECTION_INTERACTION = [
  '## 用户绑定如何与默认值交互',
  '',
  '- 用户绑定是**附加的** — 它们追加在默认绑定之后',
  '- 要将绑定**移动**到不同的键：取消绑定旧键（`null`）并添加新绑定',
  "- 上下文只需要出现在用户的文件中，如果他们想更改该上下文中的某些内容",
].join('\n')

const SECTION_COMMON_PATTERNS = [
  '## 常见模式',
  '',
  '### 重新绑定键',
  '将外部编辑器快捷键从 `ctrl+g` 更改为 `ctrl+e`：',
  '```json',
  jsonStringify(REBIND_EXAMPLE, null, 2),
  '```',
  '',
  '### 添加和弦绑定',
  '```json',
  jsonStringify(CHORD_EXAMPLE, null, 2),
  '```',
].join('\n')

const SECTION_BEHAVIORAL_RULES = [
  '## 行为规则',
  '',
  '1. 只包含用户想要更改的上下文（最小覆盖）',
  '2. 验证操作和上下文来自下面的已知列表',
  '3. 如果用户选择的键与保留快捷键或常用工具（如 tmux（`ctrl+b`）和 screen（`ctrl+a`））冲突，主动警告用户',
  '4. 为现有操作添加新绑定时，新绑定是附加的（现有默认仍可工作，除非显式取消绑定）',
  '5. 要完全替换默认绑定，取消绑定旧键并添加新键',
].join('\n')

const SECTION_DOCTOR = [
  '## 使用 /doctor 验证',
  '',
  '`/doctor` 命令包含一个"键盘绑定配置问题"部分，用于验证 `~/.claude/keybindings.json`。',
  '',
  '### 常见问题和修复',
  '',
  markdownTable(
    ['问题', '原因', '修复'],
    [
      [
        '`keybindings.json 必须有一个 "bindings" 数组`',
        '缺少包装对象',
        '将绑定包装在 `{ "bindings": [...] }` 中',
      ],
      [
        '`"bindings" 必须是一个数组`',
        '`bindings` 不是数组',
        '将 `"bindings"` 设置为数组：`[{ context: ..., bindings: ... }]`',
      ],
      [
        '`未知上下文 "X"`',
        '拼写错误或无效的上下文名称',
        '使用可用上下文表中的确切上下文名称',
      ],
      [
        '`重复键 "X" 在 Y 绑定中`',
        '在同一上下文中定义了两次相同的键',
        '移除重复项；JSON 只使用最后一个值',
      ],
      [
        '`"X" 可能无法工作：...`',
        '键与终端/操作系统保留快捷键冲突',
        '选择一个不同的键（参见保留快捷键部分）',
      ],
      [
        '`无法解析按键 "X"`',
        '无效的键语法',
        '检查语法：在修饰符之间使用 `+`，使用有效的键名',
      ],
      [
        '`"X" 的操作无效`',
        '操作值不是字符串或 null',
        '操作必须是字符串如 `"app:help"` 或 `null` 以取消绑定',
      ],
    ],
  ),
  '',
  '### 示例 /doctor 输出',
  '',
  '```',
  '键盘绑定配置问题',
  '位置：~/.claude/keybindings.json',
  '  └ [错误] 未知上下文 "chat"',
  '    → 有效上下文：Global、Chat、Autocomplete、...',
  '  └ [警告] "ctrl+c" 可能无法工作：终端中断（SIGINT）',
  '```',
  '',
  '**错误**阻止绑定工作，必须修复。**警告**表示潜在冲突，但绑定可能仍然有效。',
].join('\n')

export function registerKeybindingsSkill(): void {
  registerBundledSkill({
    name: 'keybindings-help',
    description:
      '当用户想要自定义键盘快捷键、重新绑定键、添加和弦绑定或修改 ~/.claude/keybindings.json 时使用。示例："重新绑定 ctrl+s"、"添加和弦快捷键"、"更改提交键"、"自定义快捷键"。',
    allowedTools: ['Read'],
    userInvocable: false,
    isEnabled: isKeybindingCustomizationEnabled,
    async getPromptForCommand(args) {
      // 从真实来源数组动态生成参考表
      const contextsTable = generateContextsTable()
      const actionsTable = generateActionsTable()
      const reservedShortcuts = generateReservedShortcuts()

      const sections = [
        SECTION_INTRO,
        SECTION_FILE_FORMAT,
        SECTION_KEYSTROKE_SYNTAX,
        SECTION_UNBINDING,
        SECTION_INTERACTION,
        SECTION_COMMON_PATTERNS,
        SECTION_BEHAVIORAL_RULES,
        SECTION_DOCTOR,
        `## 保留快捷键\n\n${reservedShortcuts}`,
        `## 可用上下文\n\n${contextsTable}`,
        `## 可用操作\n\n${actionsTable}`,
      ]

      if (args) {
        sections.push(`## 用户请求\n\n${args}`)
      }

      return [{ type: 'text', text: sections.join('\n\n') }]
    },
  })
}

/**
 * 从表头和行构建 markdown 表格。
 */
function markdownTable(headers: string[], rows: string[][]): string {
  const separator = headers.map(() => '---')
  return [
    `| ${headers.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}