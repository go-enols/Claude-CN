import { feature } from 'bun:bundle'
import { prependBullets } from '../../constants/prompts.js'
import { getAttributionTexts } from '../../utils/attribution.js'
import { hasEmbeddedSearchTools } from '../../utils/embeddedTools.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { shouldIncludeGitInstructions } from '../../utils/gitSettings.js'
import { getClaudeTempDir } from '../../utils/permissions/filesystem.js'
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import {
  getDefaultBashTimeoutMs,
  getMaxBashTimeoutMs,
} from '../../utils/timeouts.js'
import {
  getUndercoverInstructions,
  isUndercover,
} from '../../utils/undercover.js'
import { AGENT_TOOL_NAME } from '../AgentTool/constants.js'
import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'
import { FILE_READ_TOOL_NAME } from '../FileReadTool/prompt.js'
import { FILE_WRITE_TOOL_NAME } from '../FileWriteTool/prompt.js'
import { GLOB_TOOL_NAME } from '../GlobTool/prompt.js'
import { GREP_TOOL_NAME } from '../GrepTool/prompt.js'
import { TodoWriteTool } from '../TodoWriteTool/TodoWriteTool.js'
import { BASH_TOOL_NAME } from './toolName.js'

export function getDefaultTimeoutMs(): number {
  return getDefaultBashTimeoutMs()
}

export function getMaxTimeoutMs(): number {
  return getMaxBashTimeoutMs()
}

function getBackgroundUsageNote(): string | null {
  if (isEnvTruthy(process.env.CLAUDE_CODE_DISABLE_BACKGROUND_TASKS)) {
    return null
  }
  return "您可以使用 `run_in_background` 参数在后台运行命令。只有在您不需要立即获取结果且同意在命令完成后收到通知时，才使用此参数。您无需立即检查输出 - 完成后您将收到通知。使用此参数时，您无需在命令末尾使用 '&'。"
}

function getCommitAndPRInstructions(): string {
  // Defense-in-depth: undercover instructions must survive even if the user
  // has disabled git instructions entirely. Attribution stripping and model-ID
  // hiding are mechanical and work regardless, but the explicit "don't blow
  // your cover" instructions are the last line of defense against the model
  // volunteering an internal codename in a commit message.
  const undercoverSection =
    process.env.USER_TYPE === 'ant' && isUndercover()
      ? getUndercoverInstructions() + '\n'
      : ''

  if (!shouldIncludeGitInstructions()) return undercoverSection

  // For ant users, use the short version pointing to skills
  if (process.env.USER_TYPE === 'ant') {
    const skillsSection = !isEnvTruthy(process.env.CLAUDE_CODE_SIMPLE)
      ? `对于 git 提交和拉取请求，请使用 \`/commit\` 和 \`/commit-push-pr\` 技能：
- \`/commit\` - 使用暂存的更改创建 git 提交
- \`/commit-push-pr\` - 提交、推送并创建拉取请求

这些技能可以处理 git 安全协议、正确的提交信息格式和 PR 创建。

在创建拉取请求之前，运行 \`/simplify\` 来检查您的更改，然后进行端到端测试（例如通过 \`/tmux\` 测试交互式功能）。

`
      : ''
    return `${undercoverSection}# Git 操作

${skillsSection}重要提示：除非用户明确要求，否则切勿跳过钩子（--no-verify、--no-gpg-sign 等）。

使用 gh 命令通过 Bash 工具处理其他 GitHub 相关任务，包括处理 issues、checks 和 releases。如果给定 Github URL，请使用 gh 命令获取所需信息。

# 其他常见操作
- 查看 Github PR 的评论：gh api repos/foo/bar/pulls/123/comments`
  }

  // For external users, include full inline instructions
  const { commit: commitAttribution, pr: prAttribution } = getAttributionTexts()

  return `# 使用 git 提交更改

只有在用户要求时才创建提交。如果不确定，请先询问。当用户要求你创建新的 git 提交时，请仔细按照以下步骤操作：

你可以在一条回复中调用多个工具。当多个独立的信息被请求且所有命令都可能成功时，为获得最佳性能，请并行运行多个工具调用。下面的编号步骤表示哪些命令应该并行批量执行。

Git 安全协议：
- 永远不要更新 git 配置
- 永远不要运行破坏性 git 命令（push --force、reset --hard、checkout .、restore .、clean -f、branch -D），除非用户明确要求这些操作。未经授权的破坏性操作是无益的，可能导致工作丢失，所以最好只在收到明确指示时才运行这些命令
- 永远不要跳过钩子（--no-verify、--no-gpg-sign 等），除非用户明确要求
- 永远不要强制推送到 main/master，如果用户要求这样做，请警告用户
- 关键：始终创建新的提交，而不是修改提交，除非用户明确要求 git amend。当预提交钩子失败时，提交没有发生——所以 --amend 会修改之前的提交，可能导致工作丢失或丢失之前的更改。相反，在钩子失败后，修复问题，重新暂存，并创建一个新的提交
- 暂存文件时，优先按名称添加特定文件，而不是使用 "git add -A" 或 "git add ."，这可能会意外包含敏感文件（.env、凭据）或大型二进制文件
- 除非用户明确要求，否则不要提交更改。非常重要的是只在明确要求时提交，否则用户会觉得你太主动了

1. 运行以下 bash 命令，每个都使用 ${BASH_TOOL_NAME} 工具并行执行：
  - 运行 git status 命令查看所有未跟踪的文件。重要：永远不要使用 -uall 标志，因为这可能会导致大型仓库的内存问题。
  - 运行 git diff 命令查看将被提交的暂存和未暂存的更改。
  - 运行 git log 命令查看最近的提交消息，以便你可以遵循此仓库的提交消息风格。
2. 分析所有暂存的更改（之前已暂存和新添加的）并草拟提交消息：
  - 总结更改的性质（例如新功能、现有功能增强、错误修复、重构、测试、文档等）。确保消息准确反映更改及其目的（即"add"表示一个全新的功能，"update"表示对现有功能的增强，"fix"表示错误修复等）。
  - 不要提交可能包含密钥的文件（.env、credentials.json 等）。如果用户特别要求提交这些文件，请警告用户
  - 草拟简洁的（1-2 句话）提交消息，专注于"为什么"而不是"做什么"
  - 确保它准确反映更改及其目的
3. 并行运行以下命令：
   - 将相关的未跟踪文件添加到暂存区。
   - 创建一个带有消息的提交${commitAttribution ? ` 以以下内容结尾：\n   ${commitAttribution}` : '.'}
   - 提交完成后运行 git status 以验证成功。
   注意：git status 取决于提交完成，所以在提交后按顺序运行它。
4. 如果由于预提交钩子失败而提交失败：修复问题并创建新的提交

重要说明：
- 除了 git bash 命令外，不要运行额外的命令来读取或探索代码
- 不要使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 除非用户明确要求，否则不要推送到远程仓库
- 重要：永远不要使用 -i 标志运行 git 命令（如 git rebase -i 或 git add -i），因为它们需要交互式输入，而交互式输入不受支持。
- 重要：不要在 git rebase 命令中使用 --no-edit，因为 --no-edit 标志不是 git rebase 的有效选项。
- 如果没有要提交的更改（即没有未跟踪的文件和没有修改），则不要创建空提交
- 为确保良好的格式化，始终通过 HEREDOC 传递提交消息，例如：
<example>
git commit -m "$(cat <<'EOF'
   提交消息在这里。${commitAttribution ? `\n\n   ${commitAttribution}` : ''}
   EOF
   )"
</example>

# 创建拉取请求
通过 Bash 工具使用 gh 命令处理所有 GitHub 相关任务，包括处理 issues、pull requests、checks 和 releases。如果给定 Github URL，使用 gh 命令获取所需信息。

重要：当用户要求你创建拉取请求时，请仔细按照以下步骤操作：

1. 使用 ${BASH_TOOL_NAME} 工具并行运行以下 bash 命令，以便了解分支自与 main 分支分离以来的当前状态：
   - 运行 git status 命令查看所有未跟踪的文件（永远不要使用 -uall 标志）
   - 运行 git diff 命令查看将被提交的暂存和未暂存的更改
   - 检查当前分支是否跟踪远程分支并与远程分支保持同步，以便你知道是否需要推送到远程
   - 运行 git log 命令和 \`git diff [base-branch]...HEAD\` 来了解当前分支的完整提交历史（从它与基础分支分离的时间开始）
2. 分析将包含在拉取请求中的所有更改，确保查看所有相关的提交（不仅仅是最新的提交，而是所有将包含在拉取请求中的提交！！！），并草拟拉取请求标题和摘要：
   - 保持 PR 标题简短（70 个字符以内）
   - 使用描述/正文来获取详细信息，而不是标题
3. 并行运行以下命令：
   - 如有需要创建新分支
   - 如有需要使用 -u 标志推送到远程
   - 使用以下格式使用 gh pr create 创建 PR。使用 HEREDOC 传递正文以确保正确的格式。
<example>
gh pr create --title "pr 标题" --body "$(cat <<'EOF'
## 摘要
<1-3 个要点>

## 测试计划
[用于测试拉取请求的待办事项的 markdown 复选列表...]${prAttribution ? `\n\n${prAttribution}` : ''}
EOF
)"
</example>

重要：
- 不要使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 完成后返回 PR URL，以便用户可以看到它

# 其他常见操作
- 查看 Github PR 的评论：gh api repos/foo/bar/pulls/123/comments`
}

// SandboxManager merges config from multiple sources (settings layers, defaults,
// CLI flags) without deduping, so paths like ~/.cache appear 3× in allowOnly.
// Dedup here before inlining into the prompt — affects only what the model sees,
// not sandbox enforcement. Saves ~150-200 tokens/request when sandbox is enabled.
function dedup<T>(arr: T[] | undefined): T[] | undefined {
  if (!arr || arr.length === 0) return arr
  return [...new Set(arr)]
}

function getSimpleSandboxSection(): string {
  if (!SandboxManager.isSandboxingEnabled()) {
    return ''
  }

  const fsReadConfig = SandboxManager.getFsReadConfig()
  const fsWriteConfig = SandboxManager.getFsWriteConfig()
  const networkRestrictionConfig = SandboxManager.getNetworkRestrictionConfig()
  const allowUnixSockets = SandboxManager.getAllowUnixSockets()
  const ignoreViolations = SandboxManager.getIgnoreViolations()
  const allowUnsandboxedCommands =
    SandboxManager.areUnsandboxedCommandsAllowed()

  // Replace the per-UID temp dir literal (e.g. /private/tmp/claude-1001/) with
  // "$TMPDIR" so the prompt is identical across users — avoids busting the
  // cross-user global prompt cache. The sandbox already sets $TMPDIR at runtime.
  const claudeTempDir = getClaudeTempDir()
  const normalizeAllowOnly = (paths: string[]): string[] =>
    [...new Set(paths)].map(p => (p === claudeTempDir ? '$TMPDIR' : p))

  const filesystemConfig = {
    read: {
      denyOnly: dedup(fsReadConfig.denyOnly),
      ...(fsReadConfig.allowWithinDeny && {
        allowWithinDeny: dedup(fsReadConfig.allowWithinDeny),
      }),
    },
    write: {
      allowOnly: normalizeAllowOnly(fsWriteConfig.allowOnly),
      denyWithinAllow: dedup(fsWriteConfig.denyWithinAllow),
    },
  }

  const networkConfig = {
    ...(networkRestrictionConfig?.allowedHosts && {
      allowedHosts: dedup(networkRestrictionConfig.allowedHosts),
    }),
    ...(networkRestrictionConfig?.deniedHosts && {
      deniedHosts: dedup(networkRestrictionConfig.deniedHosts),
    }),
    ...(allowUnixSockets && { allowUnixSockets: dedup(allowUnixSockets) }),
  }

  const restrictionsLines = []
  if (Object.keys(filesystemConfig).length > 0) {
    restrictionsLines.push(`Filesystem: ${jsonStringify(filesystemConfig)}`)
  }
  if (Object.keys(networkConfig).length > 0) {
    restrictionsLines.push(`Network: ${jsonStringify(networkConfig)}`)
  }
  if (ignoreViolations) {
    restrictionsLines.push(
      `Ignored violations: ${jsonStringify(ignoreViolations)}`,
    )
  }

  const sandboxOverrideItems: Array<string | string[]> =
    allowUnsandboxedCommands
      ? [
          '你应该始终默认在沙箱内运行命令。除非以下情况，否则不要尝试设置 `dangerouslyDisableSandbox: true`：',
          [
            '用户*明确*要求你绕过沙箱',
            '某个特定命令刚刚失败，你看到沙箱限制导致失败的证据。请注意，命令可能因许多与沙箱无关的原因失败（文件缺失、参数错误、网络问题等）。',
          ],
          '沙箱导致的失败证据包括：',
          [
            '文件/网络操作的"操作不允许"错误',
            '对允许目录之外特定路径的访问被拒绝',
            '到非白名单主机的网络连接失败',
            'Unix socket 连接错误',
          ],
          '当你看到沙箱导致失败的证据时：',
          [
            "立即使用 `dangerouslyDisableSandbox: true` 重试（不要问，直接做）",
            '简要解释可能是什么沙箱限制导致了失败。请务必提到用户可以使用 `/sandbox` 命令来管理限制。',
            '这将提示用户请求权限',
          ],
          '对你使用 `dangerouslyDisableSandbox: true` 执行的每个命令逐一处理。即使你最近使用此设置运行了命令，你也应该默认在沙箱内运行未来的命令。',
          '不要建议将敏感路径如 ~/.bashrc、~/.zshrc、~/.ssh/* 或凭据文件添加到沙箱允许列表中。',
        ]
      : [
          '所有命令必须在沙箱模式下运行 - `dangerouslyDisableSandbox` 参数已被策略禁用。',
          '在任何情况下，命令都不能在沙箱外运行。',
          '如果命令由于沙箱限制而失败，请与用户一起调整沙箱设置。',
        ]

  const items: Array<string | string[]> = [
    ...sandboxOverrideItems,
    '对于临时文件，始终使用 `$TMPDIR` 环境变量。TMPDIR 在沙箱模式下自动设置为正确的沙箱可写目录。不要直接使用 `/tmp`——请使用 `$TMPDIR`。',
  ]

  return [
    '',
    '## 命令沙箱',
    '默认情况下，你的命令将在沙箱中运行。此沙箱控制哪些目录和网络主机可以在没有明确覆盖的情况下被命令访问或修改。',
    '',
    '沙箱有以下限制：',
    restrictionsLines.join('\n'),
    '',
    ...prependBullets(items),
  ].join('\n')
}

export function getSimplePrompt(): string {
  // Ant-native builds alias find/grep to embedded bfs/ugrep in Claudes shell,
  // so we dont steer away from them (and Glob/Grep tools are removed).
  const embedded = hasEmbeddedSearchTools()

  const toolPreferenceItems = [
    ...(embedded
      ? []
      : [
          `文件搜索：使用 ${GLOB_TOOL_NAME}（不要使用 find 或 ls）`,
          `内容搜索：使用 ${GREP_TOOL_NAME}（不要使用 grep 或 rg）`,
        ]),
    `读取文件：使用 ${FILE_READ_TOOL_NAME}（不要使用 cat/head/tail）`,
    `编辑文件：使用 ${FILE_EDIT_TOOL_NAME}（不要使用 sed/awk）`,
    `写入文件：使用 ${FILE_WRITE_TOOL_NAME}（不要使用 echo >/cat <<EOF）`,
    `通信：直接输出文本（不要使用 echo/printf）`,
  ]

  const avoidCommands = embedded
    ? '`cat`、`head`、`tail`、`sed`、`awk` 或 `echo`'
    : '`find`、`grep`、`cat`、`head`、`tail`、`sed`、`awk` 或 `echo`'

  const multipleCommandsSubitems = [
    `如果命令是独立的且可以并行运行，请在一条消息中进行多个 ${BASH_TOOL_NAME} 工具调用。例如，如果你需要运行 "git status" 和 "git diff"，请发送一条包含两个并行 ${BASH_TOOL_NAME} 工具调用的消息。`,
    `如果命令相互依赖且必须按顺序运行，请使用带有 && 的单个 ${BASH_TOOL_NAME} 调用将它们链接在一起。`,
    "只有在需要按顺序运行命令但不在乎早期命令是否失败时才使用 ;。",
    `不要使用换行符来分隔命令（换行符在引号字符串中是可以的）。`,
  ]

  const gitSubitems = [
    `优先创建新提交，而不是修改现有提交。`,
    `在运行破坏性操作之前（例如 git reset --hard、git push --force、git checkout --），考虑是否有更安全的替代方案来实现相同目标。只有在破坏性操作确实是最佳方法时才使用它们。`,
    `除非用户明确要求，否则不要跳过钩子（--no-verify）或绕过签名（--no-gpg-sign、-c commit.gpgsign=false）。如果钩子失败，调查并修复根本问题。`,
  ]

  const sleepSubitems = [
    `不要在可以立即运行的命令之间睡眠——直接运行它们。`,
    ...(feature('MONITOR_TOOL')
      ? [
          `使用 Monitor 工具从后台进程流式传输事件（每个 stdout 行都是一个通知）。对于一次性的"等待完成"，请改用带 run_in_background 的 Bash。`,
        ]
      : []),
    `如果你的命令运行时间较长，希望在完成时收到通知——使用 \`run_in_background\`。不需要睡眠。`,
    `不要在睡眠循环中重试失败的命令——诊断根本原因。`,
    `如果你正在等待使用 \`run_in_background\` 启动的后台任务，你将在完成时收到通知——不要轮询。`,
    ...(feature('MONITOR_TOOL')
      ? [
          `第一个命令使用 \`sleep N\` 且 N ≥ 2 会被阻止。如果你需要延迟（速率限制、有意的节奏），请保持在 2 秒以下。`,
        ]
      : [
          `如果必须轮询外部进程，使用检查命令（例如 \`gh run view\`）而不是先睡眠。`,
          `如果必须睡眠，保持时间简短（1-5 秒）以避免阻塞用户。`,
        ]),
  ]
  const backgroundNote = getBackgroundUsageNote()

  const instructionItems: Array<string | string[]> = [
    `如果你的命令将创建新目录或文件，首先使用此工具运行 \`ls\` 来验证父目录存在且位置正确。`,
    `始终在命令中用双引号引用包含空格的文件路径（例如，cd "path with spaces/file.txt"）`,
    `尝试通过使用绝对路径并避免使用 \`cd\` 来保持整个会话中的当前工作目录。如果用户明确要求，可以使用 \`cd\`。`,
    `你可以指定可选的超时时间（最多 ${getMaxTimeoutMs()}ms / ${getMaxTimeoutMs() / 60000} 分钟）。默认情况下，你的命令将在 ${getDefaultTimeoutMs()}ms（${getDefaultTimeoutMs() / 60000} 分钟）后超时。`,
    ...(backgroundNote !== null ? [backgroundNote] : []),
    `当发出多个命令时：`,
    multipleCommandsSubitems,
    `对于 git 命令：`,
    gitSubitems,
    `避免不必要的 \`sleep\` 命令：`,
    sleepSubitems,
    ...(embedded
      ? [
          // bfs (which backs `find`) uses Oniguruma for -regex, which picks the
          // FIRST matching alternative (leftmost-first), unlike GNU finds
          // POSIX leftmost-longest. This silently drops matches when a shorter
          // alternative is a prefix of a longer one.
          "当使用 `find -regex` 与 alternation 时，将最长的选项放在前面。例如，使用 `.*\\.\\(tsx\\|ts\\)` 而不是 `.*\\.\\(ts\\|tsx\\)` —— 第二种形式会静默跳过 `.tsx` 文件。",
        ]
      : []),
  ]

  return [
    `执行给定的 bash 命令并返回其输出。`,
    ``,
    `工作目录在命令之间保持不变，但 shell 状态不会。Shell 环境从用户的配置文件（bash 或 zsh）初始化。`,
    ,
    `重要：除非明确指示或在你已验证专用工具无法完成任务后，否则避免使用此工具运行 ${avoidCommands} 命令。相反，使用适当的专用工具，因为这将为用户提供更好的体验并使查看工具调用和授予权限变得更容易：`,
    ,
    ...prependBullets(toolPreferenceItems),
    `虽然 ${BASH_TOOL_NAME} 工具可以做类似的事情，但最好使用内置工具，因为它们提供更好的用户体验，使查看工具调用和授予权限更容易。`,
    ,
    `# 说明`,
    ...prependBullets(instructionItems),
    getSimpleSandboxSection(),
    ...(getCommitAndPRInstructions() ? [, getCommitAndPRInstructions()] : []),
  ].join('\n')
}
