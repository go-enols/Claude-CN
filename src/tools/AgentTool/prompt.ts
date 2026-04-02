import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { getSubscriptionType } from '../../utils/auth.js'
import { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import { isEnvDefinedFalsy, isEnvTruthy } from '../../utils/envUtils.js'
import { isTeammate } from '../../utils/teammate.js'
import { isInProcessTeammate } from '../../utils/teammateContext.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { SEND_MESSAGE_TOOL_NAME } from '../SendMessageTool/constants.js'
import { AGENT_TOOL_NAME } from './constants.js'
import { isForkSubagentEnabled } from './forkSubagent.js'
import type { AgentDefinition } from './loadAgentsDir.js'

function getToolsDescription(agent: AgentDefinition): string {
  const { tools, disallowedTools } = agent
  const hasAllowlist = tools && tools.length > 0
  const hasDenylist = disallowedTools && disallowedTools.length > 0

  if (hasAllowlist && hasDenylist) {
    // Both defined: filter allowlist by denylist to match runtime behavior
    const denySet = new Set(disallowedTools)
    const effectiveTools = tools.filter(t => !denySet.has(t))
    if (effectiveTools.length === 0) {
      return '无'
    }
    return effectiveTools.join(', ')
  } else if (hasAllowlist) {
    // Allowlist only: show the specific tools available
    return tools.join(', ')
  } else if (hasDenylist) {
    // Denylist only: show "All tools except X, Y, Z"
    return `除 ${disallowedTools.join(', ')} 外的所有工具`
  }
  // No restrictions
  return '所有工具'
}

/**
 * Format one agent line for the agent_listing_delta attachment message:
 * `- type: whenToUse (Tools: ...)`.
 */
export function formatAgentLine(agent: AgentDefinition): string {
  const toolsDescription = getToolsDescription(agent)
  return `- ${agent.agentType}: ${agent.whenToUse} (Tools: ${toolsDescription})`
}

/**
 * Whether the agent list should be injected as an attachment message instead
 * of embedded in the tool description. When true, getPrompt() returns a static
 * description and attachments.ts emits an agent_listing_delta attachment.
 *
 * The dynamic agent list was ~10.2% of fleet cache_creation tokens: MCP async
 * connect, /reload-plugins, or permission-mode changes mutate the list →
 * description changes → full tool-schema cache bust.
 *
 * Override with CLAUDE_CODE_AGENT_LIST_IN_MESSAGES=true/false for testing.
 */
export function shouldInjectAgentListInMessages(): boolean {
  if (isEnvTruthy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES)) return true
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_AGENT_LIST_IN_MESSAGES))
    return false
  return getFeatureValue_CACHED_MAY_BE_STALE('tengu_agent_list_attach', false)
}

export async function getPrompt(
  agentDefinitions: AgentDefinition[],
  isCoordinator?: boolean,
  allowedAgentTypes?: string[],
): Promise<string> {
  // Filter agents by allowed types when Agent(x,y) restricts which agents can be spawned
  const effectiveAgents = allowedAgentTypes
    ? agentDefinitions.filter(a => allowedAgentTypes.includes(a.agentType))
    : agentDefinitions

  // Fork subagent feature: when enabled, insert the "When to fork" section
  // (fork semantics, directive-style prompts) and swap in fork-aware examples.
  const forkEnabled = isForkSubagentEnabled()

  const whenToForkSection = forkEnabled
    ? `

## 何时使用分支

当你认为中间的工具输出不值得保留在上下文中时，可以分支自己（省略 \`subagent_type\`）。标准是定性的——"我是否需要再次使用这个输出"——而不是任务大小。
- **研究**：分支处理开放性问题。如果研究可以分为独立的问题，在一条消息中启动多个并行分支。分支比新的子代理更适合处理研究任务——它继承上下文并共享你的缓存。
- **实现**：对于需要多个编辑的实现工作，优先使用分支。在跳入实现之前先进行研究。

分支很便宜，因为它们共享你的 prompt 缓存。不要在分支上设置 \`model\`——不同的模型无法复用父级的缓存。传递一个简短的 \`name\`（一两个词，小写），以便用户可以在团队面板中看到分支并在其中途运行时引导它。

**不要偷看。** 工具结果包含一个 \`output_file\` 路径——除非用户明确要求查看进度，否则不要读取或跟踪它。你会收到完成通知；相信它。飞行中读取记录会将分支的工具噪音拉入你的上下文，这就失去了分支的意义。

**不要竞速。** 发射后，你不知道分支发现了什么。永远不要以任何形式捏造或预测分支结果——无论是散文、摘要还是结构化输出。通知会在后续回合中作为用户角色消息到达；它永远不是你写的东西。如果用户在通知到达前提出了后续问题，告诉他们分支仍在运行——给出状态，而不是猜测。

**编写分支 prompt。** 由于分支继承你的上下文，prompt 是一个*指令*——要做什么，而不是情况是什么。要具体说明范围：包含什么、排除什么、另一个代理在处理什么。不要重新解释背景。
`
    : ''

  const writingThePromptSection = `

## 编写 prompt

${forkEnabled ? '当生成一个新的代理（带有 `subagent_type`）时，它从零上下文开始。' : ''}像对待一个刚走进房间的聪明同事一样向代理介绍任务——它没有看到这次对话，不知道你尝试过什么，不理解为什么这个任务重要。
- 解释你试图完成什么以及为什么。
- 描述你已经学到或排除的内容。
- 提供足够的问题背景，让代理可以做出判断，而不仅仅是遵循狭窄的指令。
- 如果你需要简短回复，明确说明（"200 字以内报告"）。
- 查询：直接给出命令。调查：直接给出问题——当前提错误时，规定的步骤会变成死代码。

${forkEnabled ? '对于新代理，简短的' : '简短的'}命令式 prompt 会产生浅显、通用的工作。

**不要委托理解。** 不要写"根据你的发现，修复 bug"或"根据研究，实现它"。这些短语将综合工作推给代理，而不是你自己做。写出能证明你理解了的 prompt：包含文件路径、行号、具体要改什么。
`

  const forkExamples = `使用示例：

<example>
user: "在这个分支上线之前还剩下什么？"
assistant: <thinking>为此分支——这是一个调查问题。我想要待办事项，而不是我上下文中的 git 输出。</thinking>
${AGENT_TOOL_NAME}({
  name: "ship-audit",
  description: "分支上线准备情况审计",
  prompt: "审计这个分支在上线前还剩下什么。检查：未提交的更改、相对于 main 的领先提交、是否存在测试、是否接入了 GrowthBook 门控、CI 相关文件是否更改。报告待办事项——已完成与缺失。200 字以内。"
})
assistant: 上线准备情况审计运行中。
<commentary>
回合在此结束。协调器还不知道调查结果。接下来是单独的回合——通知从外部作为用户角色消息到达。它不是协调器写的东西。
</commentary>
[后续回合——通知作为用户消息到达]
assistant: 审计回来了。三个障碍：新的 prompt 路径没有测试、GrowthBook 门控已接入但不在 build_flags.yaml 中、以及一个未提交的文件。
</example>

<example>
user: "那么门控到底接入了没有"
<commentary>
用户在等待期间提问。审计分支正是为了回答这个问题而启动的，还没有返回。协调器没有这个答案。给出状态，而不是捏造的结果。
</commentary>
assistant: 仍在等待审计——这是它正在检查的事项之一。应该很快就会完成。
</example>

<example>
user: "你能就这个迁移是否安全获取第二个意见吗？"
assistant: <thinking>我会询问代码审查代理——它不会看到我的分析，所以可以给出独立的看法。</thinking>
<commentary>
指定了 subagent_type，所以代理全新开始。它需要在 prompt 中有完整的背景。简报解释要评估什么以及为什么。
</commentary>
${AGENT_TOOL_NAME}({
  name: "migration-review",
  description: "独立迁移审查",
  subagent_type: "code-reviewer",
  prompt: "审查 0042_user_schema.sql 迁移的安全性。背景：我们正在向一个 5000 万行的表添加 NOT NULL 列。现有行获得回填默认值。我想就回填方法在并发写入下是否安全获得第二个意见——我已检查了锁定行为，但想要独立验证。报告：这个安全吗，如果不安全，具体是什么会出问题？"
})
</example>
`

  const currentExamples = `使用示例：

<example_agent_descriptions>
"test-runner": 在写完代码后使用此代理运行测试
"greeting-responder": 使用此代理用有趣的笑话回应用户问候
</example_agent_descriptions>

<example>
user: "请写一个检查数字是否为质数的函数"
assistant: 我将使用 ${FILE_WRITE_TOOL_NAME} 工具编写以下代码：
<code>
function isPrime(n) {
  if (n <= 1) return false
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) return false
  }
  return true
}
</code>
<commentary>
由于写了一段重要的代码且任务已完成，现在使用 test-runner 代理运行测试
</commentary>
assistant: 使用 ${AGENT_TOOL_NAME} 工具启动 test-runner 代理
</example>

<example>
user: "你好"
<commentary>
由于用户正在问候，使用 greeting-responder 代理用有趣的笑话回应
</commentary>
assistant: "我将使用 ${AGENT_TOOL_NAME} 工具启动 greeting-responder 代理"
</example>
`

  // When the gate is on, the agent list lives in an agent_listing_delta
  // attachment (see attachments.ts) instead of inline here. This keeps the
  // tool description static across MCP/plugin/permission changes so the
  // tools-block prompt cache doesn't bust every time an agent loads.
  const listViaAttachment = shouldInjectAgentListInMessages()

  const agentListSection = listViaAttachment
    ? `可用的代理类型列在会话中的 <system-reminder> 消息中。`
    : `可用的代理类型及其可访问的工具：
${effectiveAgents.map(agent => formatAgentLine(agent)).join('\n')}`

  // Shared core prompt used by both coordinator and non-coordinator modes
  const shared = `启动一个新的代理来自主处理复杂的多步骤任务。

${AGENT_TOOL_NAME} 工具启动专门的代理（子进程）来自主处理复杂任务。每种代理类型都有特定的能力和可用工具。

${agentListSection}

${
  forkEnabled
    ? `使用 ${AGENT_TOOL_NAME} 工具时，指定 subagent_type 来使用专门的代理，或省略它来分支自己——分支继承你的完整对话上下文。`
    : `使用 ${AGENT_TOOL_NAME} 工具时，指定 subagent_type 参数来选择要使用的代理类型。如果省略，则使用通用代理。`
}`

  // Coordinator mode gets the slim prompt -- the coordinator system prompt
  // already covers usage notes, examples, and when-not-to-use guidance.
  if (isCoordinator) {
    return shared
  }

  // Ant-native builds alias find/grep to embedded bfs/ugrep and remove the
  // dedicated Glob/Grep tools, so point at find via Bash instead.
  const embedded = hasEmbeddedSearchTools()
  const fileSearchHint = embedded
    ? '通过 Bash 工具使用 `find`'
    : `使用 ${GLOB_TOOL_NAME} 工具`
  // The "class Foo" example is about content search. Non-embedded stays Glob
  // (original intent: find-the-file-containing). Embedded gets grep because
  // find -name doesn't look at file contents.
  const contentSearchHint = embedded
    ? '通过 Bash 工具使用 `grep`'
    : `使用 ${GLOB_TOOL_NAME} 工具`
  const whenNotToUseSection = forkEnabled
    ? ''
    : `
何时不使用 ${AGENT_TOOL_NAME} 工具：
- 如果你想读取特定的文件路径，使用 ${FILE_READ_TOOL_NAME} 工具或 ${fileSearchHint} 而不是 ${AGENT_TOOL_NAME} 工具，以便更快找到匹配
- 如果你在搜索特定的类定义如 "class Foo"，使用 ${contentSearchHint} 而不是 ${AGENT_TOOL_NAME} 工具，以便更快找到匹配
- 如果你在特定文件或 2-3 个文件集合中搜索代码，使用 ${FILE_READ_TOOL_NAME} 工具而不是 ${AGENT_TOOL_NAME} 工具，以便更快找到匹配
- 其他与上述代理描述无关的任务
`

  // When listing via attachment, the "launch multiple agents" note is in the
  // attachment message (conditioned on subscription there). When inline, keep
  // the existing per-call getSubscriptionType() check.
  const concurrencyNote =
    !listViaAttachment && getSubscriptionType() !== 'pro'
      ? `
- 尽可能并发启动多个代理以最大化性能；为此，使用包含多个工具调用的单条消息`
      : ''

  // Non-coordinator gets the full prompt with all sections
  return `${shared}
${whenNotToUseSection}

使用说明：
- 始终包含一个简短描述（3-5 个词）来总结代理将做什么${concurrencyNote}
- 当代理完成时，它会返回一条消息给你。代理返回的结果不会显示给用户。要向用户显示结果，你应该向用户发送一条简洁总结结果的文本消息。${
    // eslint-disable-next-line custom-rules/no-process-env-top-level
    !isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS) &&
    !isInProcessTeammate() &&
    !forkEnabled
      ? `
- 你可以使用 run_in_background 参数选择在后台运行代理。当代理在后台运行时，你将在其完成时自动收到通知——不要睡眠、轮询或主动检查其进度。继续其他工作或回复用户。
- **前台与后台**：当你需要在继续之前获取代理的结果时使用前台（默认）——例如，其发现会影响你下一步的研究代理。当你有真正独立的并行工作时使用后台。`
      : ''
  }
- 要继续之前启动的代理，使用 ${SEND_MESSAGE_TOOL_NAME} 并将代理的 ID 或名称作为 \`to\` 字段。代理会保留其完整上下文继续执行。${forkEnabled ? '每次带 subagent_type 的新 Agent 调用都从零开始——提供完整的任务描述。' : '每次 Agent 调用都从头开始——提供完整的任务描述。'}
- 代理的输出通常应该被信任
- 明确告诉代理你期望它写代码还是只做研究（搜索、文件读取、网络获取等）${forkEnabled ? '' : '，因为它不知道用户的意图'}
- 如果代理描述提到它应该被主动使用，那么你应该尽量使用它，而不需要用户先要求你。使用你的判断力。
- 如果用户指定他们希望你"并行"运行代理，你必须发送包含多个 ${AGENT_TOOL_NAME} 工具使用内容块的单一消息。例如，如果你需要并行启动 build-validator 代理和 test-runner 代理，发送包含两个工具调用的单一消息。
- 你可以设置 \`isolation: "worktree"\` 来在临时 git worktree 中运行代理，为它提供仓库的隔离副本。如果代理没有做出任何更改，worktree 会自动清理；如果做了更改，worktree 路径和分支会在结果中返回。${
    process.env.USER_TYPE === 'ant'
      ? `\n- 你可以设置 \`isolation: "remote"\` 来在远程 CCR 环境中运行代理。这始终是后台任务；你将在完成时收到通知。用于需要全新沙箱的长时运行任务。`
      : ''
  }${
    isInProcessTeammate()
      ? `
- run_in_background、name、team_name 和 mode 参数在此上下文中不可用。仅支持同步子代理。`
      : isTeammate()
        ? `
- name、team_name 和 mode 参数在此上下文中不可用——队友不能生成其他队友。省略它们来生成子代理。`
        : ''
  }${whenToForkSection}${writingThePromptSection}

${forkEnabled ? forkExamples : currentExamples}`
}
