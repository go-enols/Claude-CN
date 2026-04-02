import type { ZodIssueCode } from 'zod/v4'

// v4 ZodIssueCode is a value, not a type - use typeof to get the type
type ZodIssueCodeType = (typeof ZodIssueCode)[keyof typeof ZodIssueCode]

export type ValidationTip = {
  suggestion?: string
  docLink?: string
}

export type TipContext = {
  path: string
  code: ZodIssueCodeType | string
  expected?: string
  received?: unknown
  enumValues?: string[]
  message?: string
  value?: unknown
}

type TipMatcher = {
  matches: (context: TipContext) => boolean
  tip: ValidationTip
}

const DOCUMENTATION_BASE = 'https://code.claude.com/docs/en'

const TIP_MATCHERS: TipMatcher[] = [
  {
    matches: (ctx): boolean =>
      ctx.path === 'permissions.defaultMode' && ctx.code === 'invalid_value',
    tip: {
      suggestion:
        '有效模式："acceptEdits"（文件更改前询问）、"plan"（仅分析）、"bypassPermissions"（自动接受所有）或 "default"（标准行为）',
      docLink: `${DOCUMENTATION_BASE}/iam#permission-modes`,
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.path === 'apiKeyHelper' && ctx.code === 'invalid_type',
    tip: {
      suggestion:
        '提供一个将 API 密钥输出到 stdout 的 shell 命令。脚本应仅输出 API 密钥。示例："/bin/generate_temp_api_key.sh"',
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.path === 'cleanupPeriodDays' &&
      ctx.code === 'too_small' &&
      ctx.expected === '0',
    tip: {
      suggestion:
        '必须为 0 或更大。设置正数以保留对话记录的天数（默认为 30）。设置为 0 将完全禁用会话持久化：不会写入对话记录，现有对话记录将在启动时删除。',
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.path.startsWith('env.') && ctx.code === 'invalid_type',
    tip: {
      suggestion:
        '环境变量必须是字符串。将数字和布尔值用引号包裹。示例："DEBUG": "true", "PORT": "3000"',
      docLink: `${DOCUMENTATION_BASE}/settings#environment-variables`,
    },
  },
  {
    matches: (ctx): boolean =>
      (ctx.path === 'permissions.allow' || ctx.path === 'permissions.deny') &&
      ctx.code === 'invalid_type' &&
      ctx.expected === 'array',
    tip: {
      suggestion:
        '权限规则必须是数组格式：["Tool(说明符)"]。示例：["Bash(npm run build)", "Edit(docs/**)", "Read(~/.zshrc)"]。使用 * 作为通配符。',
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.path.includes('hooks') && ctx.code === 'invalid_type',
    tip: {
      suggestion:
        // gh-31187 / CC-282: prior example showed {"matcher": {"tools": ["BashTool"]}}
        // — an object format that never existed in the schema (matcher is z.string(),
        // always has been). Users copied the tip's example and got the same validation
        // error again. See matchesPattern() in hooks.ts: matcher is exact-match,
        // pipe-separated ("Edit|Write"), or regex. Empty/"*" matches all.
        '钩子使用 matcher + hooks 数组。matcher 是字符串：工具名称（"Bash"）、管道分隔列表（"Edit|Write"）或空以匹配所有。示例：{"PostToolUse": [{"matcher": "Edit|Write", "hooks": [{"type": "command", "command": "echo Done"}]}]}',
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.code === 'invalid_type' && ctx.expected === 'boolean',
    tip: {
      suggestion:
        '使用 true 或 false，不加引号。示例："includeCoAuthoredBy": true',
    },
  },
  {
    matches: (ctx): boolean => ctx.code === 'unrecognized_keys',
    tip: {
      suggestion:
        '检查拼写错误或参考文档中的有效字段',
      docLink: `${DOCUMENTATION_BASE}/settings`,
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.code === 'invalid_value' && ctx.enumValues !== undefined,
    tip: {
      suggestion: undefined,
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.code === 'invalid_type' &&
      ctx.expected === 'object' &&
      ctx.received === null &&
      ctx.path === '',
    tip: {
      suggestion:
        '检查是否有缺少的逗号、未匹配的括号或尾部逗号。使用 JSON 验证器来识别确切的语法错误。',
    },
  },
  {
    matches: (ctx): boolean =>
      ctx.path === 'permissions.additionalDirectories' &&
      ctx.code === 'invalid_type',
    tip: {
      suggestion:
        '必须是目录路径数组。示例：["~/projects", "/tmp/workspace"]。也可以使用 --add-dir 标志或 /add-dir 命令',
      docLink: `${DOCUMENTATION_BASE}/iam#working-directories`,
    },
  },
]

const PATH_DOC_LINKS: Record<string, string> = {
  permissions: `${DOCUMENTATION_BASE}/iam#configuring-permissions`,
  env: `${DOCUMENTATION_BASE}/settings#environment-variables`,
  hooks: `${DOCUMENTATION_BASE}/hooks`,
}

export function getValidationTip(context: TipContext): ValidationTip | null {
  const matcher = TIP_MATCHERS.find(m => m.matches(context))

  if (!matcher) return null

  const tip: ValidationTip = { ...matcher.tip }

  if (
    context.code === 'invalid_value' &&
    context.enumValues &&
    !tip.suggestion
  ) {
    tip.suggestion = `有效值：${context.enumValues.map(v => `"${v}"`).join(', ')}`
  }

  // Add documentation link based on path prefix
  if (!tip.docLink && context.path) {
    const pathPrefix = context.path.split('.')[0]
    if (pathPrefix) {
      tip.docLink = PATH_DOC_LINKS[pathPrefix]
    }
  }

  return tip
}
