import { z } from 'zod/v4'
import { mcpInfoFromString } from '../../services/mcp/mcpStringUtils.js'
import { lazySchema } from '../lazySchema.js'
import { permissionRuleValueFromString } from '../permissions/permissionRuleParser.js'
import { capitalize } from '../stringUtils.js'
import {
  getCustomValidation,
  isBashPrefixTool,
  isFilePatternTool,
} from './toolValidationConfig.js'

/**
 * Checks if a character at a given index is escaped (preceded by odd number of backslashes).
 */
function isEscaped(str: string, index: number): boolean {
  let backslashCount = 0
  let j = index - 1
  while (j >= 0 && str[j] === '\\') {
    backslashCount++
    j--
  }
  return backslashCount % 2 !== 0
}

/**
 * Counts unescaped occurrences of a character in a string.
 * A character is considered escaped if preceded by an odd number of backslashes.
 */
function countUnescapedChar(str: string, char: string): number {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char && !isEscaped(str, i)) {
      count++
    }
  }
  return count
}

/**
 * Checks if a string contains unescaped empty parentheses "()".
 * Returns true only if both the "(" and ")" are unescaped and adjacent.
 */
function hasUnescapedEmptyParens(str: string): boolean {
  for (let i = 0; i < str.length - 1; i++) {
    if (str[i] === '(' && str[i + 1] === ')') {
      // Check if the opening paren is unescaped
      if (!isEscaped(str, i)) {
        return true
      }
    }
  }
  return false
}

/**
 * Validates permission rule format and content
 */
export function validatePermissionRule(rule: string): {
  valid: boolean
  error?: string
  suggestion?: string
  examples?: string[]
} {
  // Empty rule check
  if (!rule || rule.trim() === '') {
    return { valid: false, error: '权限规则不能为空' }
  }

  // Check parentheses matching first (only count unescaped parens)
  const openCount = countUnescapedChar(rule, '(')
  const closeCount = countUnescapedChar(rule, ')')
  if (openCount !== closeCount) {
    return {
      valid: false,
      error: '括号不匹配',
      suggestion:
        '确保所有左括号都有匹配的右括号',
    }
  }

  // Check for empty parentheses (escape-aware)
  if (hasUnescapedEmptyParens(rule)) {
    const toolName = rule.substring(0, rule.indexOf('('))
    if (!toolName) {
      return {
        valid: false,
        error: '空括号且没有工具名称',
        suggestion: '在括号前指定工具名称',
      }
    }
    return {
      valid: false,
      error: '空括号',
      suggestion: `指定模式或直接使用 "${toolName}" 而不加括号`,
      examples: [`${toolName}`, `${toolName}(some-pattern)`],
    }
  }

  // Parse the rule
  const parsed = permissionRuleValueFromString(rule)

  // MCP validation - must be done before general tool validation
  const mcpInfo = mcpInfoFromString(parsed.toolName)
  if (mcpInfo) {
    // MCP rules support server-level, tool-level, and wildcard permissions
    // Valid formats:
    // - mcp__server (server-level, all tools)
    // - mcp__server__* (wildcard, all tools - equivalent to server-level)
    // - mcp__server__tool (specific tool)

    // MCP rules cannot have any pattern/content (parentheses)
    // Check both parsed content and raw string since the parser normalizes
    // standalone wildcards (e.g., "mcp__server(*)") to undefined ruleContent
    if (parsed.ruleContent !== undefined || countUnescapedChar(rule, '(') > 0) {
      return {
        valid: false,
        error: 'MCP 规则不支持括号中的模式',
        suggestion: `使用 "${parsed.toolName}" 而不加括号，或使用 "mcp__${mcpInfo.serverName}__*" 表示所有工具`,
        examples: [
          `mcp__${mcpInfo.serverName}`,
          `mcp__${mcpInfo.serverName}__*`,
          mcpInfo.toolName && mcpInfo.toolName !== '*'
            ? `mcp__${mcpInfo.serverName}__${mcpInfo.toolName}`
            : undefined,
        ].filter(Boolean) as string[],
      }
    }

    return { valid: true } // Valid MCP rule
  }

  // Tool name validation (for non-MCP tools)
  if (!parsed.toolName || parsed.toolName.length === 0) {
    return { valid: false, error: '工具名称不能为空' }
  }

  // Check tool name starts with uppercase (standard tools)
  if (parsed.toolName[0] !== parsed.toolName[0]?.toUpperCase()) {
    return {
      valid: false,
      error: '工具名称必须以大写字母开头',
      suggestion: `使用 "${capitalize(String(parsed.toolName))}"`,
    }
  }

  // Check for custom validation rules first
  const customValidation = getCustomValidation(parsed.toolName)
  if (customValidation && parsed.ruleContent !== undefined) {
    const customResult = customValidation(parsed.ruleContent)
    if (!customResult.valid) {
      return customResult
    }
  }

  // Bash-specific validation
  if (isBashPrefixTool(parsed.toolName) && parsed.ruleContent !== undefined) {
    const content = parsed.ruleContent

    // Check for common :* mistakes - :* must be at the end (legacy prefix syntax)
    if (content.includes(':*') && !content.endsWith(':*')) {
      return {
        valid: false,
        error: ':* 模式必须在末尾',
        suggestion:
          '将 :* 移到末尾进行前缀匹配，或使用 * 进行通配符匹配',
        examples: [
          'Bash(npm run:*) - prefix matching (legacy)',
          'Bash(npm run *) - wildcard matching',
        ],
      }
    }

    // Check for :* without a prefix
    if (content === ':*') {
      return {
        valid: false,
        error: ':* 前的前缀不能为空',
        suggestion: '在 :* 前指定命令前缀',
        examples: ['Bash(npm:*)', 'Bash(git:*)'],
      }
    }

    // Note: We don't validate quote balancing because bash quoting rules are complex.
    // A command like `grep '"'` has valid unbalanced double quotes.
    // Users who create patterns with unintended quote mismatches will discover
    // the issue when matching doesn't work as expected.

    // Wildcards are now allowed at any position for flexible pattern matching
    // Examples of valid wildcard patterns:
    // - "npm *" matches "npm install", "npm run test", etc.
    // - "* install" matches "npm install", "yarn install", etc.
    // - "git * main" matches "git checkout main", "git push main", etc.
    // - "npm * --save" matches "npm install foo --save", etc.
    //
    // Legacy :* syntax continues to work for backwards compatibility:
    // - "npm:*" matches "npm" or "npm <anything>" (prefix matching with word boundary)
  }

  // File tool validation
  if (isFilePatternTool(parsed.toolName) && parsed.ruleContent !== undefined) {
    const content = parsed.ruleContent

    // Check for :* in file patterns (common mistake from Bash patterns)
    if (content.includes(':*')) {
      return {
        valid: false,
        error: '":*" 语法仅适用于 Bash 前缀规则',
        suggestion: '使用 glob 模式如 "*" 或 "**" 进行文件匹配',
        examples: [
          `${parsed.toolName}(*.ts) - matches .ts files`,
          `${parsed.toolName}(src/**) - matches all files in src`,
          `${parsed.toolName}(**/*.test.ts) - matches test files`,
        ],
      }
    }

    // Warn about wildcards not at boundaries
    if (
      content.includes('*') &&
      !content.match(/^\*|\*$|\*\*|\/\*|\*\.|\*\)/) &&
      !content.includes('**')
    ) {
      // This is a loose check - wildcards in the middle might be valid in some cases
      // but often indicate confusion
      return {
        valid: false,
        error: '通配符位置可能不正确',
        suggestion: '通配符通常用于路径边界',
        examples: [
          `${parsed.toolName}(*.js) - all .js files`,
          `${parsed.toolName}(src/*) - all files directly in src`,
          `${parsed.toolName}(src/**) - all files recursively in src`,
        ],
      }
    }
  }

  return { valid: true }
}

/**
 * Custom Zod schema for permission rule arrays
 */
export const PermissionRuleSchema = lazySchema(() =>
  z.string().superRefine((val, ctx) => {
    const result = validatePermissionRule(val)
    if (!result.valid) {
      let message = result.error!
      if (result.suggestion) {
        message += `. ${result.suggestion}`
      }
      if (result.examples && result.examples.length > 0) {
        message += `. Examples: ${result.examples.join(', ')}`
      }
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        params: { received: val },
      })
    }
  }),
)
