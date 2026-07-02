import { feature } from 'bun:bundle'
import { isReplBridgeActive } from '../../bootstrap/state.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import type { Tool } from '../../Tool.js'
import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
// Dead code elimination: Brief tool name only needed when KAIROS or KAIROS_BRIEF is on
/* eslint-disable @typescript-eslint/no-require-imports */
const BRIEF_TOOL_NAME: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../BriefTool/prompt.js') as typeof import('../BriefTool/prompt.js')
      ).BRIEF_TOOL_NAME
    : null
const SEND_USER_FILE_TOOL_NAME: string | null = feature('KAIROS')
  ? (
      require('../SendUserFileTool/prompt.js') as typeof import('../SendUserFileTool/prompt.js')
    ).SEND_USER_FILE_TOOL_NAME
  : null
/* eslint-enable @typescript-eslint/no-require-imports */
export { TOOL_SEARCH_TOOL_NAME } from './constants.js'
import { TOOL_SEARCH_TOOL_NAME } from './constants.js'
const PROMPT_HEAD = `获取延迟加载工具的完整 schema 定义，以便可以调用它们。
`
// Matches isDeferredToolsDeltaEnabled in toolSearch.ts (not imported —
// toolSearch.ts imports from this file). When enabled: tools announced
// via system-reminder attachments. When disabled: prepended
// <available-deferred-tools> block (pre-gate behavior).
function getToolLocationHint(): string {
  const deltaEnabled =
    process.env.USER_TYPE === 'ant' ||
    getFeatureValue_CACHED_MAY_BE_STALE('tengu_glacier_2xr', false)
  return deltaEnabled
    ? '延迟加载工具通过名称出现在 <system-reminder> 消息中。'
    : '延迟加载工具通过名称出现在 <available-deferred-tools> 消息中。'
}
const PROMPT_TAIL = ` 在获取之前，只知道工具名称 — 没有参数 schema，因此无法调用工具。此工具接收一个查询，将其与延迟加载工具列表进行匹配，并返回匹配工具的完整 JSONSchema 定义，包裹在 <functions> 块中。一旦工具的 schema 出现在结果中，就可以像调用提示词顶部定义的任何工具一样调用它。
结果格式：每个匹配的工具在 <functions> 块中显示为一行 <function>{"description": "...", "name": "...", "parameters": {...}}</function> — 与提示词顶部的工具列表使用相同的编码。
查询形式：
- "select:Read,Edit,Grep" — 按名称获取这些确切的工具
- "notebook jupyter" — 关键词搜索，最多返回 max_results 个最佳匹配
- "+slack send" — 要求名称中包含 "slack"，按其余关键词排序`
/**
 * Check if a tool should be deferred (requires ToolSearch to load).
 * A tool is deferred if:
 * - It's an MCP tool (always deferred - workflow-specific)
 * - It has shouldDefer: true
 *
 * A tool is NEVER deferred if it has alwaysLoad: true (MCP tools set this via
 * _meta['anthropic/alwaysLoad']). This check runs first, before any other rule.
 */
export function isDeferredTool(tool: Tool): boolean {
  // Explicit opt-out via _meta['anthropic/alwaysLoad'] — tool appears in the
  // initial prompt with full schema. Checked first so MCP tools can opt out.
  if (tool.alwaysLoad === true) return false
  // MCP tools are always deferred (workflow-specific)
  if (tool.isMcp === true) return true
  // Never defer ToolSearch itself — the model needs it to load everything else
  if (tool.name === TOOL_SEARCH_TOOL_NAME) return false
  // Fork-first experiment: Agent must be available turn 1, not behind ToolSearch.
  // Lazy require: static import of forkSubagent → coordinatorMode creates a cycle
  // through constants/tools.ts at module init.
  if (feature('FORK_SUBAGENT') && tool.name === AGENT_TOOL_NAME) {
    type ForkMod = typeof import('../AgentTool/forkSubagent.js')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('../AgentTool/forkSubagent.js') as ForkMod
    if (m.isForkSubagentEnabled()) return false
  }
  // Brief is the primary communication channel whenever the tool is present.
  // Its prompt contains the text-visibility contract, which the model must
  // see without a ToolSearch round-trip. No runtime gate needed here: this
  // tool's isEnabled() IS isBriefEnabled(), so being asked about its deferral
  // status implies the gate already passed.
  if (
    (feature('KAIROS') || feature('KAIROS_BRIEF')) &&
    BRIEF_TOOL_NAME &&
    tool.name === BRIEF_TOOL_NAME
  ) {
    return false
  }
  // SendUserFile is a file-delivery communication channel (sibling of Brief).
  // Must be immediately available without a ToolSearch round-trip.
  if (
    feature('KAIROS') &&
    SEND_USER_FILE_TOOL_NAME &&
    tool.name === SEND_USER_FILE_TOOL_NAME &&
    isReplBridgeActive()
  ) {
    return false
  }
  return tool.shouldDefer === true
}
/**
 * Format one deferred-tool line for the <available-deferred-tools> user
 * message. Search hints (tool.searchHint) are not rendered — the
 * hints A/B (exp_xenhnnmn0smrx4, stopped Mar 21) showed no benefit.
 */
export function formatDeferredToolLine(tool: Tool): string {
  return tool.name
}
export function getPrompt(): string {
  return PROMPT_HEAD + getToolLocationHint() + PROMPT_TAIL
}
