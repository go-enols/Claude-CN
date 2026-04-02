import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import type { MCPServerConnection } from '../../services/mcp/types.js'
import { isPolicyAllowed } from '../../services/policyLimits/index.js'
import type { ToolUseContext } from '../../Tool.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../../tools/AskUserQuestionTool/prompt.js'
import { REMOTE_TRIGGER_TOOL_NAME } from '../../tools/RemoteTriggerTool/prompt.js'
import { getClaudeAIOAuthTokens } from '../../utils/auth.js'
import { checkRepoForRemoteAccess } from '../../utils/background/remote/preconditions.js'
import { logForDebugging } from '../../utils/debug.js'
import {
  detectCurrentRepositoryWithHost,
  parseGitRemote,
} from '../../utils/detectRepository.js'
import { getRemoteUrl } from '../../utils/git.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  createDefaultCloudEnvironment,
  type EnvironmentResource,
  fetchEnvironments,
} from '../../utils/teleport/environments.js'
import { registerBundledSkill } from '../bundledSkills.js'

// Base58 字母表（比特币风格），用于带标签的 ID 系统
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

/**
 * 将 mcpsrv_ 带标签的 ID 解码为 UUID 字符串。
 * 带标签的 ID 格式：mcpsrv_01{base58(uuid.int)}
 * 其中 01 是版本前缀。
 *
 * TODO(public-ship)：在公开发货之前，/v1/mcp_servers 端点
 * 应该直接返回原始 UUID，这样我们就不需要这种客户端解码。
 * 带标签的 ID 格式是一个内部实现细节，可能会改变。
 */
function taggedIdToUUID(taggedId: string): string | null {
  const prefix = 'mcpsrv_'
  if (!taggedId.startsWith(prefix)) {
    return null
  }
  const rest = taggedId.slice(prefix.length)
  // 跳过版本前缀（2 个字符，始终是 "01"）
  const base58Data = rest.slice(2)

  // 将 base58 解码为 bigint
  let n = 0n
  for (const c of base58Data) {
    const idx = BASE58.indexOf(c)
    if (idx === -1) {
      return null
    }
    n = n * 58n + BigInt(idx)
  }

  // 转换为 UUID 十六进制字符串
  const hex = n.toString(16).padStart(32, '0')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

type ConnectorInfo = {
  uuid: string
  name: string
  url: string
}

function getConnectedClaudeAIConnectors(
  mcpClients: MCPServerConnection[],
): ConnectorInfo[] {
  const connectors: ConnectorInfo[] = []
  for (const client of mcpClients) {
    if (client.type !== 'connected') {
      continue
    }
    if (client.config.type !== 'claudeai-proxy') {
      continue
    }
    const uuid = taggedIdToUUID(client.config.id)
    if (!uuid) {
      continue
    }
    connectors.push({
      uuid,
      name: client.name,
      url: client.config.url,
    })
  }
  return connectors
}

function sanitizeConnectorName(name: string): string {
  return name
    .replace(/^claude[.\s-]ai[.\s-]/i, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function formatConnectorsInfo(connectors: ConnectorInfo[]): string {
  if (connectors.length === 0) {
    return '未找到连接的 MCP 连接器。用户可能需要在 https://claude.ai/settings/connectors 连接服务器'
  }
  const lines = ['已连接连接器（可用于触发器）：']
  for (const c of connectors) {
    const safeName = sanitizeConnectorName(c.name)
    lines.push(
      `- ${c.name} (connector_uuid: ${c.uuid}, name: ${safeName}, url: ${c.url})`,
    )
  }
  return lines.join('\n')
}

const BASE_QUESTION = '您想对计划的远程代理做什么？'

/**
 * 将设置说明格式化为项目符号警告块。在
 * 初始 AskUserQuestion 对话框文本（无参数路径）和提示正文
 * 部分（参数路径）之间共享，因此说明永远不会被静默丢弃。
 */
function formatSetupNotes(notes: string[]): string {
  const items = notes.map(n => `- ${n}`).join('\n')
  return `⚠ 注意事项：\n${items}`
}

async function getCurrentRepoHttpsUrl(): Promise<string | null> {
  const remoteUrl = await getRemoteUrl()
  if (!remoteUrl) {
    return null
  }
  const parsed = parseGitRemote(remoteUrl)
  if (!parsed) {
    return null
  }
  return `https://${parsed.host}/${parsed.owner}/${parsed.name}`
}

function buildPrompt(opts: {
  userTimezone: string
  connectorsInfo: string
  gitRepoUrl: string | null
  environmentsInfo: string
  createdEnvironment: EnvironmentResource | null
  setupNotes: string[]
  needsGitHubAccessReminder: boolean
  userArgs: string
}): string {
  const {
    userTimezone,
    connectorsInfo,
    gitRepoUrl,
    environmentsInfo,
    createdEnvironment,
    setupNotes,
    needsGitHubAccessReminder,
    userArgs,
  } = opts
  // 当用户传递参数时，会跳过初始 AskUserQuestion 对话框。
  // 设置说明必须在提示正文中显示，否则它们
  // 会被计算并静默丢弃（与旧的硬阻止相比是回归）。
  const setupNotesSection =
    userArgs && setupNotes.length > 0
      ? `\n## 设置说明\n\n${formatSetupNotes(setupNotes)}\n`
      : ''
  const initialQuestion =
    setupNotes.length > 0
      ? `${formatSetupNotes(setupNotes)}\n\n${BASE_QUESTION}`
      : BASE_QUESTION
  const firstStep = userArgs
    ? `用户已经告诉他们想要什么（见底部的用户请求）。跳过初始问题，直接进入匹配的工作流。`
    : `您的第一个操作必须是单个 ${ASK_USER_QUESTION_TOOL_NAME} 工具调用（无前言）。使用此确切字符串作为 \`question\` 字段 — 不要释义或缩短：

${jsonStringify(initialQuestion)}

设置 \`header: "Action"\` 并将四个操作（创建/列出/更新/运行）作为选项提供。在用户选择后，按照下面的匹配工作流进行。`

  return `# 计划远程代理

您正在帮助用户计划、更新、列出或运行**远程** Claude Code 代理。这些不是本地 cron 作业 — 每个触发器都会在 Anthropic 的云基础设施中按 cron 计划生成完全隔离的远程会话（CCR）。代理在沙盒环境中运行，有自己的 git 检出、工具和可选的 MCP 连接。

## 第一步

${firstStep}
${setupNotesSection}

## 您可以做什么

使用 \`${REMOTE_TRIGGER_TOOL_NAME}\` 工具（首先用 \`ToolSearch select:${REMOTE_TRIGGER_TOOL_NAME}\` 加载它；认证在进程内处理 — 不要使用 curl）：

- \`{action: "list"}\` — 列出所有触发器
- \`{action: "get", trigger_id: "..."}\` — 获取一个触发器
- \`{action: "create", body: {...}}\` — 创建触发器
- \`{action: "update", trigger_id: "...", body: {...}}\` — 部分更新
- \`{action: "run", trigger_id: "..."}\` — 立即运行触发器

您无法删除触发器。如果用户要求删除，请引导他们访问：https://claude.ai/code/scheduled

## 创建主体形状

\`\`\`json
{
  "name": "AGENT_NAME",
  "cron_expression": "CRON_EXPR",
  "enabled": true,
  "job_config": {
    "ccr": {
      "environment_id": "ENVIRONMENT_ID",
      "session_context": {
        "model": "claude-sonnet-4-6",
        "sources": [
          {"git_repository": {"url": "${gitRepoUrl || 'https://github.com/ORG/REPO'}"}}
        ],
        "allowed_tools": ["Bash", "Read", "Write", "Edit", "Glob", "Grep"]
      },
      "events": [
        {"data": {
          "uuid": "<小写 v4 uuid>",
          "session_id": "",
          "type": "user",
          "parent_tool_use_id": null,
          "message": {"content": "PROMPT_HERE", "role": "user"}
        }}
      ]
    }
  }
}
\`\`\`

为 \`events[].data.uuid\` 自行生成新的小写 UUID。

## 可用 MCP 连接器

这些是用户当前已连接的 claude.ai MCP 连接器：

${connectorsInfo}

将连接器附加到触发器时，使用上面显示的 \`connector_uuid\` 和 \`name\`（名称已经过清理，仅包含字母、数字、连字符和下划线），以及连接器的 URL。\`mcp_connections\` 中的 \`name\` 字段只能包含 \`[a-zA-Z0-9_-]\` — 点和空格不允许。

**重要：** 从用户的描述中推断代理需要哪些服务。例如，如果他们说"检查 Datadog 并通过 Slack 发送错误给我"，代理需要 Datadog 和 Slack 连接器。与上面的列表交叉引用，如果任何必需服务未连接则发出警告。如果缺少所需的连接器，引导用户先访问 https://claude.ai/settings/connectors 连接它。

## 环境

每个触发器都需要 \`job_config\` 中的 \`environment_id\`。这决定远程代理运行的位置。询问用户使用哪个环境。

${environmentsInfo}

使用 \`id\` 值作为 \`job_config.ccr.environment_id\`。
${createdEnvironment ? `\n**注意：** 因为用户没有环境，刚刚为用户创建了一个新环境 \`${createdEnvironment.name}\`（id：\`${createdEnvironment.environment_id}\`）。将此 id 用于 \`job_config.ccr.environment_id\` 并在确认触发器配置时提及创建。\n` : ''}

## API 字段参考

### 创建触发器 — 必填字段
- \`name\`（字符串）— 描述性名称
- \`cron_expression\`（字符串）— 5 字段 cron。**最小间隔为 1 小时。**
- \`job_config\`（对象）— 会话配置（见上方结构）

### 创建触发器 — 可选字段
- \`enabled\`（布尔值，默认：true）
- \`mcp_connections\`（数组）— 附加的 MCP 服务器：
  \`\`\`json
  [{"connector_uuid": "uuid", "name": "server-name", "url": "https://..."}]
  \`\`\`

### 更新触发器 — 可选字段
所有字段都是可选的（部分更新）：
- \`name\`、\`cron_expression\`、\`enabled\`、\`job_config\`
- \`mcp_connections\` — 替换 MCP 连接
- \`clear_mcp_connections\`（布尔值）— 移除所有 MCP 连接

### Cron 表达式示例

用户的本地时区是 **${userTimezone}**。Cron 表达式始终为 UTC。当用户说本地时间时，将其转换为 UTC 用于 cron 表达式但与他们确认："${userTimezone} 上午 9 点 = UTC 上午 X 点，所以 cron 是 \`0 X * * 1-5\`。"

- \`0 9 * * 1-5\` — 每个工作日上午 9 点 **UTC**
- \`0 */2 * * *\` — 每 2 小时
- \`0 0 * * *\` — 每天午夜 **UTC**
- \`30 14 * * 1\` — 每周一下午 2:30 **UTC**
- \`0 8 1 * *\` — 每月第一天上午 8 点 **UTC**

最小间隔为 1 小时。\`*/30 * * * *\` 将被拒绝。

## 工作流

### 创建新触发器：

1. **了解目标** — 询问他们希望远程代理做什么。什么仓库？什么任务？提醒他们代理在远程运行 — 它无法访问他们的本地机器、本地文件或本地环境变量。
2. **编写提示** — 帮助他们写出有效的代理提示。好的提示是：
   - 明确要做什么以及成功是什么样子
   - 清楚哪些文件/区域要关注
   - 明确要采取什么行动（打开 PR、提交、仅分析等）
3. **设置计划** — 询问何时以及多久一次。用户的时区是 ${userTimezone}。当他们说一个时间（例如"每天早上 9 点"），假设他们指的是本地时间并转换为 UTC 用于 cron 表达式。始终确认转换："${userTimezone} 上午 9 点 = UTC 上午 X 点。"
4. **选择模型** — 默认为 \`claude-sonnet-4-6\`。告诉用户您默认使用哪个模型，询问他们是否想要不同的模型。
5. **验证连接** — 从用户的描述中推断代理将需要哪些服务。例如，如果他们说"检查 Datadog 并通过 Slack 发送错误给我"，代理需要 Datadog 和 Slack MCP 连接器。与上面的连接器列表交叉引用。如果任何缺失，警告用户并链接他们到 https://claude.ai/settings/connectors 先连接。${gitRepoUrl ? ` 默认 git 仓库已设置为 \`${gitRepoUrl}\`。询问用户这是否是正确的仓库，或者他们是否需要不同的仓库。` : ' 询问远程代理需要克隆到其环境的 git 仓库。'}
6. **审核并确认** — 在创建前显示完整配置。让他们调整。
7. **创建** — 使用 \`action: "create"\` 调用 \`${REMOTE_TRIGGER_TOOL_NAME}\` 并显示结果。响应包含触发器 ID。始终在最后输出一个链接：\`https://claude.ai/code/scheduled/{TRIGGER_ID}\`

### 更新触发器：

1. 首先列出触发器以便他们可以选择
2. 询问他们想更改什么
3. 显示当前值与建议值
4. 确认并更新

### 列出触发器：

1. 获取并以可读格式显示
2. 显示：名称、计划（人类可读）、启用/禁用、下次运行、仓库

### 立即运行：

1. 如果他们未指定哪个触发器，先列出触发器
2. 确认哪个触发器
3. 执行并确认

## 重要说明

- 这些是远程代理 — 它们在 Anthropic 的云中运行，而不是在用户的机器上。它们无法访问本地文件、本地服务或本地环境变量。
- 在显示时始终将 cron 转换为人类可读格式
- 默认为 \`enabled: true\`，除非用户另有说明
- 接受任何格式的 GitHub URL（https://github.com/org/repo、org/repo 等）并规范化为完整 HTTPS URL（无 .git 后缀）
- 提示是最重要的部分 — 花时间把它做好。远程代理从零上下文开始，因此提示必须是自包含的。
- 要删除触发器，引导用户访问 https://claude.ai/code/scheduled
${needsGitHubAccessReminder ? `- 如果用户的请求似乎需要 GitHub 仓库访问（例如克隆仓库、打开 PR、读取代码），提醒他们 ${getFeatureValue_CACHED_MAY_BE_STALE('tengu_cobalt_lantern', false) ? "他们应该运行 /web-setup 来连接他们的 GitHub 账户（或者作为替代方案在仓库上安装 Claude GitHub App）— 否则远程代理将无法访问它" : "他们需要在仓库上安装 Claude GitHub App — 否则远程代理将无法访问它"}。` : ''}
${userArgs ? `\n## 用户请求\n\n用户说："${userArgs}"\n\n首先了解他们的意图，然后按照上面的适当工作流程进行。` : ''}`
}

export function registerScheduleRemoteAgentsSkill(): void {
  registerBundledSkill({
    name: 'schedule',
    description:
      '创建、更新、列出或运行按 cron 计划执行的计划远程代理（触发器）。',
    whenToUse:
      '当用户想要计划重复远程代理、设置自动化任务、为 Claude Code 创建 cron 作业或管理他们的计划代理/触发器时使用。',
    userInvocable: true,
    isEnabled: () =>
      getFeatureValue_CACHED_MAY_BE_STALE('tengu_surreal_dali', false) &&
      isPolicyAllowed('allow_remote_sessions'),
    allowedTools: [REMOTE_TRIGGER_TOOL_NAME, ASK_USER_QUESTION_TOOL_NAME],
    async getPromptForCommand(args: string, context: ToolUseContext) {
      if (!getClaudeAIOAuthTokens()?.accessToken) {
        return [
          {
            type: 'text',
            text: '您需要首先通过 claude.ai 账户进行身份验证。不支持 API 账户。运行 /login，然后重试 /schedule。',
          },
        ]
      }

      let environments: EnvironmentResource[]
      try {
        environments = await fetchEnvironments()
      } catch (err) {
        logForDebugging(`[schedule] 获取环境失败：${err}`, {
          level: 'warn',
        })
        return [
          {
            type: 'text',
            text: '我们在连接您的远程 claude.ai 账户以设置计划任务时遇到问题。请几分钟后重试 /schedule。',
          },
        ]
      }

      let createdEnvironment: EnvironmentResource | null = null
      if (environments.length === 0) {
        try {
          createdEnvironment = await createDefaultCloudEnvironment(
            'claude-code-default',
          )
          environments = [createdEnvironment]
        } catch (err) {
          logForDebugging(`[schedule] 创建环境失败：${err}`, {
            level: 'warn',
          })
          return [
            {
              type: 'text',
              text: '未找到远程环境，无法自动创建。请访问 https://claude.ai/code 设置一个，然后重试 /schedule。',
            },
          ]
        }
      }

      // 软设置检查 — 作为前置说明收集，嵌入在初始
      // AskUserQuestion 对话框中。永不阻止 — 触发器不需要 git
      // 来源（例如，仅 Slack 轮询），并且触发器的来源可能指向
      // 与 cwd 不同的仓库。
      const setupNotes: string[] = []
      let needsGitHubAccessReminder = false

      const repo = await detectCurrentRepositoryWithHost()
      if (repo === null) {
        setupNotes.push(
          `不在 git 仓库中 — 您需要手动指定仓库 URL（或者完全跳过仓库）。`,
        )
      } else if (repo.host === 'github.com') {
        const { hasAccess } = await checkRepoForRemoteAccess(
          repo.owner,
          repo.name,
        )
        if (!hasAccess) {
          needsGitHubAccessReminder = true
          const webSetupEnabled = getFeatureValue_CACHED_MAY_BE_STALE(
            'tengu_cobalt_lantern',
            false,
          )
          const msg = webSetupEnabled
            ? `${repo.owner}/${repo.name} 未连接 GitHub — 运行 /web-setup 同步您的 GitHub 凭据，或在 https://claude.ai/code/onboarding?magic=github-app-setup 安装 Claude GitHub App。`
            : `在 ${repo.owner}/${repo.name} 上未安装 Claude GitHub App — 如果您的触发器需要此仓库，请在 https://claude.ai/code/onboarding?magic=github-app-setup 安装。`
          setupNotes.push(msg)
        }
      }
      // 非 github.com 主机（GHE/GitLab 等）：静默跳过。GitHub
      // App 检查是 github.com 特定的，并且"不在 git 仓库中"说明
      // 在事实上是错误的 — 下面的 getCurrentRepoHttpsUrl() 仍将
      // 用 GHE URL 填充 gitRepoUrl。

      const connectors = getConnectedClaudeAIConnectors(
        context.options.mcpClients,
      )
      if (connectors.length === 0) {
        setupNotes.push(
          `无 MCP 连接器 — 如需要，请在 https://claude.ai/settings/connectors 连接。`,
        )
      }

      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const connectorsInfo = formatConnectorsInfo(connectors)
      const gitRepoUrl = await getCurrentRepoHttpsUrl()
      const lines = ['可用环境：']
      for (const env of environments) {
        lines.push(
          `- ${env.name} (id: ${env.environment_id}, kind: ${env.kind})`,
        )
      }
      const environmentsInfo = lines.join('\n')
      const prompt = buildPrompt({
        userTimezone,
        connectorsInfo,
        gitRepoUrl,
        environmentsInfo,
        createdEnvironment,
        setupNotes,
        needsGitHubAccessReminder,
        userArgs: args,
      })
      return [{ type: 'text', text: prompt }]
    },
  })
}