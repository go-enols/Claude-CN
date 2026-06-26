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
  return "您可以使用 `run_in_background` 参数在后台运行命令。仅在不需要立即获取结果且可以在命令稍后完成时收到通知的情况下使用此参数。您不需要立即检查输出 — 命令完成时您会收到通知。使用此参数时，您不需要在命令末尾使用 '&'。"
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

这些技能处理 git 安全协议、正确的提交消息格式和 PR 创建。

在创建拉取请求之前，运行 \`/simplify\` 来审查您的更改，然后进行端到端测试（例如通过 \`/tmux\` 测试交互功能）。

`
      : ''
    return `${undercoverSection}# Git 操作

${skillsSection}重要提示：切勿跳过钩子（--no-verify、--no-gpg-sign 等），除非用户明确要求。

对于其他 GitHub 相关任务（包括处理 issues、checks 和 releases），请通过 Bash 工具使用 gh 命令。如果提供了 Github URL，请使用 gh 命令获取所需信息。

# 其他常见操作
- 查看 Github PR 上的评论：gh api repos/foo/bar/pulls/123/comments`
  }

  // For external users, include full inline instructions
  const { commit: commitAttribution, pr: prAttribution } = getAttributionTexts()

  return `# 使用 git 提交更改

仅在用户要求时创建提交。如果不确定，请先询问。当用户要求您创建新的 git 提交时，请仔细按照以下步骤操作：

您可以在单个响应中调用多个工具。当需要多个独立的信息片段且所有命令都可能成功时，并行运行多个工具调用以获得最佳性能。以下编号步骤表示哪些命令应批量并行执行。

Git 安全协议：
- 切勿更新 git 配置
- 切勿运行破坏性 git 命令（push --force、reset --hard、checkout .、restore .、clean -f、branch -D），除非用户明确要求这些操作。未经授权的破坏性操作是无益的，可能导致工作丢失，因此最好仅在收到直接指示时运行这些命令
- 切勿跳过钩子（--no-verify、--no-gpg-sign 等），除非用户明确要求
- 切勿对 main/master 进行强制推送，如果用户要求则警告他们
- 关键：始终创建新提交而不是修改现有提交，除非用户明确要求 git amend。当 pre-commit 钩子失败时，提交并未发生 — 因此 --amend 会修改上一个提交，这可能导致销毁工作或丢失之前的更改。相反，在钩子失败后，修复问题，重新暂存，并创建新提交
- 暂存文件时，优先按名称添加特定文件，而不是使用 "git add -A" 或 "git add ."，这可能会意外包含敏感文件（.env、凭据）或大型二进制文件
- 除非用户明确要求，否则切勿提交更改。仅在明确要求时才提交非常重要，否则用户会觉得您过于主动

1. 并行运行以下 bash 命令，每个命令使用 ${BASH_TOOL_NAME} 工具：
  - 运行 git status 命令查看所有未跟踪的文件。重要提示：切勿使用 -uall 标志，因为它可能在大型仓库中导致内存问题。
  - 运行 git diff 命令查看将提交的暂存和未暂存更改。
  - 运行 git log 命令查看最近的提交消息，以便您可以遵循此仓库的提交消息风格。
2. 分析所有暂存的更改（之前暂存的和新添加的）并草拟提交消息：
  - 总结更改的性质（例如新功能、对现有功能的增强、错误修复、重构、测试、文档等）。确保消息准确反映更改及其目的（即 "add" 表示全新功能，"update" 表示对现有功能的增强，"fix" 表示错误修复等）。
  - 不要提交可能包含机密的文件（.env、credentials.json 等）。如果用户特别要求提交这些文件，请警告用户。
  - 草拟简洁的（1-2 句话）提交消息，侧重于"为什么"而不是"是什么"
  - 确保它准确反映更改及其目的
3. 并行运行以下命令：
   - 将相关的未跟踪文件添加到暂存区。
   - 创建提交并附带消息${commitAttribution ? `，以以下内容结尾：\n   ${commitAttribution}` : '。'}
   - 提交完成后运行 git status 以验证成功。
   注意：git status 依赖于提交完成，因此请在提交后顺序运行它。
4. 如果提交因 pre-commit 钩子失败：修复问题并创建新提交

重要说明：
- 除了 git bash 命令之外，切勿运行额外的命令来读取或探索代码
- 切勿使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 除非用户明确要求，否则不要推送到远程仓库
- 重要提示：切勿对 git 命令使用 -i 标志（如 git rebase -i 或 git add -i），因为它们需要交互式输入，而这不受支持。
- 重要提示：不要对 git rebase 命令使用 --no-edit，因为 --no-edit 标志不是 git rebase 的有效选项。
- 如果没有要提交的更改（即没有未跟踪的文件且没有修改），不要创建空提交
- 为确保良好的格式，始终通过 HEREDOC 传递提交消息，示例如下：
<example>
git commit -m "$(cat <<'EOF'
   提交消息在此。${commitAttribution ? `\n\n   ${commitAttribution}` : ''}
   EOF
   )"
</example>

# 创建拉取请求
对于所有 GitHub 相关任务（包括处理 issues、拉取请求、checks 和 releases），请通过 Bash 工具使用 gh 命令。如果提供了 Github URL，请使用 gh 命令获取所需信息。

重要提示：当用户要求您创建拉取请求时，请仔细按照以下步骤操作：

1. 并行运行以下 bash 命令，使用 ${BASH_TOOL_NAME} 工具，以了解分支自与主分支分叉以来的当前状态：
   - 运行 git status 命令查看所有未跟踪的文件（切勿使用 -uall 标志）
   - 运行 git diff 命令查看将提交的暂存和未暂存更改
   - 检查当前分支是否跟踪远程分支并与远程保持同步，以便您知道是否需要推送到远程
   - 运行 git log 命令和 \`git diff [base-branch]...HEAD\` 以了解当前分支的完整提交历史（从与基础分支分叉时起）
2. 分析将包含在拉取请求中的所有更改，确保查看所有相关提交（不仅仅是最近的提交，而是将包含在拉取请求中的所有提交！！！），并草拟拉取请求标题和摘要：
   - 保持 PR 标题简短（70 个字符以内）
   - 使用描述/正文提供详细信息，而非标题
3. 并行运行以下命令：
   - 如果需要，创建新分支
   - 如果需要，使用 -u 标志推送到远程
   - 使用以下格式的 gh pr create 创建 PR。使用 HEREDOC 传递正文以确保正确格式。
<example>
gh pr create --title "PR 标题" --body "$(cat <<'EOF'
## 摘要
<1-3 个要点>

## 测试计划
[用于测试拉取请求的待办事项的 markdown 清单...]${prAttribution ? `\n\n${prAttribution}` : ''}
EOF
)"
</example>

重要提示：
- 不要使用 ${TodoWriteTool.name} 或 ${AGENT_TOOL_NAME} 工具
- 完成后返回 PR URL，以便用户查看

# 其他常见操作
- 查看 Github PR 上的评论：gh api repos/foo/bar/pulls/123/comments`
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
          '您应始终默认在沙箱中运行命令。除非以下情况，否则不要尝试设置 `dangerouslyDisableSandbox: true`：',
          [
            '用户*明确*要求您绕过沙箱',
            '某个特定命令刚刚失败，并且您看到了沙箱限制导致失败的证据。请注意，命令可能因与沙箱无关的多种原因而失败（文件缺失、参数错误、网络问题等）。',
          ],
          '沙箱导致失败的证据包括：',
          [
            '文件/网络操作出现"Operation not permitted"错误',
            '访问允许目录之外特定路径被拒绝',
            '连接到非白名单主机的网络连接失败',
            'Unix socket 连接错误',
          ],
          '当您看到沙箱导致失败的证据时：',
          [
            "立即使用 `dangerouslyDisableSandbox: true` 重试（不要询问，直接执行）",
            '简要说明可能是什么沙箱限制导致了失败。务必提及用户可以使用 `/sandbox` 命令来管理限制。',
            '这将提示用户授予权限',
          ],
          '将每个使用 `dangerouslyDisableSandbox: true` 执行的命令单独处理。即使您最近使用此设置运行过命令，您也应默认在沙箱中运行未来的命令。',
          '不要建议将敏感路径（如 ~/.bashrc、~/.zshrc、~/.ssh/* 或凭据文件）添加到沙箱白名单中。',
        ]
      : [
          '所有命令必须在沙箱模式下运行 - `dangerouslyDisableSandbox` 参数已被策略禁用。',
          '在任何情况下，命令都不能在沙箱之外运行。',
          '如果命令因沙箱限制而失败，请与用户合作调整沙箱设置。',
        ]

  const items: Array<string | string[]> = [
    ...sandboxOverrideItems,
    '对于临时文件，始终使用 `$TMPDIR` 环境变量。在沙箱模式下，TMPDIR 会自动设置为正确的沙箱可写目录。不要直接使用 `/tmp` — 请改用 `$TMPDIR`。',
  ]

  return [
    '',
    '## 命令沙箱',
    '默认情况下，您的命令将在沙箱中运行。此沙箱控制命令可以访问或修改哪些目录和网络主机，除非有明确的覆盖。',
    '',
    '沙箱具有以下限制：',
    restrictionsLines.join('\n'),
    '',
    ...prependBullets(items),
  ].join('\n')
}

export function getSimplePrompt(): string {
  // Ant-native builds alias find/grep to embedded bfs/ugrep in Claude's shell,
  // so we don't steer away from them (and Glob/Grep tools are removed).
  const embedded = hasEmbeddedSearchTools()

  const toolPreferenceItems = [
    ...(embedded
      ? []
      : [
          `文件搜索：使用 ${GLOB_TOOL_NAME}（而非 find 或 ls）`,
          `内容搜索：使用 ${GREP_TOOL_NAME}（而非 grep 或 rg）`,
        ]),
    `读取文件：使用 ${FILE_READ_TOOL_NAME}（而非 cat/head/tail）`,
    `编辑文件：使用 ${FILE_EDIT_TOOL_NAME}（而非 sed/awk）`,
    `写入文件：使用 ${FILE_WRITE_TOOL_NAME}（而非 echo >/cat <<EOF）`,
    '通信：直接输出文本（而非 echo/printf）',
  ]

  const avoidCommands = embedded
    ? '`cat`, `head`, `tail`, `sed`, `awk`, or `echo`'
    : '`find`, `grep`, `cat`, `head`, `tail`, `sed`, `awk`, or `echo`'

  const multipleCommandsSubitems = [
    `如果命令是独立的且可以并行运行，请在单条消息中进行多个 ${BASH_TOOL_NAME} 工具调用。例如：如果您需要运行 "git status" 和 "git diff"，请发送一条包含两个并行 ${BASH_TOOL_NAME} 工具调用的消息。`,
    `如果命令相互依赖且必须顺序运行，请使用单个 ${BASH_TOOL_NAME} 调用，用 '&&' 将它们串联起来。`,
    "仅在需要顺序运行命令但不关心前面的命令是否失败时使用 ';'。",
    '不要使用换行符来分隔命令（引号字符串中的换行符是可以的）。',
  ]

  const gitSubitems = [
    '优先创建新提交而不是修改现有提交。',
    '在运行破坏性操作之前（例如 git reset --hard、git push --force、git checkout --），请考虑是否有更安全的替代方案可以达到相同目标。仅在破坏性操作确实是最佳方法时才使用它们。',
    '除非用户明确要求，否则切勿跳过钩子（--no-verify）或绕过签名（--no-gpg-sign、-c commit.gpgsign=false）。如果钩子失败，请调查并修复根本问题。',
  ]

  const sleepSubitems = [
    '不要在可以立即运行的命令之间使用 sleep — 直接运行它们。',
    ...(feature('MONITOR_TOOL')
      ? [
          '使用 Monitor 工具来流式传输后台进程的事件（每行 stdout 都是一条通知）。对于一次性"等待完成"的场景，请改用带 run_in_background 的 Bash。',
        ]
      : []),
    '如果您的命令是长时间运行的，并且您希望在完成时收到通知 — 请使用 `run_in_background`。无需 sleep。',
    '不要在 sleep 循环中重试失败的命令 — 诊断根本原因。',
    '如果等待您使用 `run_in_background` 启动的后台任务，您将在任务完成时收到通知 — 不要轮询。',
    ...(feature('MONITOR_TOOL')
      ? [
          '`sleep N` 作为第一个命令且 N ≥ 2 时会被阻止。如果您需要延迟（速率限制、有意的节奏控制），请将其保持在 2 秒以下。',
        ]
      : [
          '如果必须轮询外部进程，请使用检查命令（例如 `gh run view`）而不是先 sleep。',
          '如果必须 sleep，请保持持续时间短（1-5 秒）以避免阻塞用户。',
        ]),
  ]
  const backgroundNote = getBackgroundUsageNote()

  const instructionItems: Array<string | string[]> = [
    '如果您的命令将创建新目录或文件，请先使用此工具运行 `ls` 来验证父目录是否存在且位置正确。',
    '始终在命令中使用双引号括起包含空格的文件路径（例如 cd "path with spaces/file.txt"）',
    '尽量通过使用绝对路径和避免使用 `cd` 来在整个会话中保持当前工作目录。如果用户明确要求，您可以使用 `cd`。',
    `您可以指定可选的超时时间（以毫秒为单位，最多 ${getMaxTimeoutMs()} 毫秒 / ${getMaxTimeoutMs() / 60000} 分钟）。默认情况下，您的命令将在 ${getDefaultTimeoutMs()} 毫秒（${getDefaultTimeoutMs() / 60000} 分钟）后超时。`,
    ...(backgroundNote !== null ? [backgroundNote] : []),
    '当发出多个命令时：',
    multipleCommandsSubitems,
    '对于 git 命令：',
    gitSubitems,
    '避免不必要的 `sleep` 命令：',
    sleepSubitems,
    ...(embedded
      ? [
          // bfs (which backs `find`) uses Oniguruma for -regex, which picks the
          // FIRST matching alternative (leftmost-first), unlike GNU find's
          // POSIX leftmost-longest. This silently drops matches when a shorter
          // alternative is a prefix of a longer one.
          "在使用 `find -regex` 进行交替匹配时，将最长的替代项放在最前面。示例：使用 `'.*\\.\\(tsx\\|ts\\)'` 而不是 `'.*\\.\\(ts\\|tsx\\)'` — 第二种形式会静默跳过 `.tsx` 文件。",
        ]
      : []),
  ]

  return [
    '执行给定的 bash 命令并返回其输出。',
    '',
    "工作目录在命令之间保持不变，但 shell 状态不会。shell 环境从用户的配置文件（bash 或 zsh）初始化。",
    '',
    `重要提示：避免使用此工具运行 ${avoidCommands} 命令，除非有明确指示或您已验证专用工具无法完成您的任务。请改用适当的专用工具，因为这将为用户提供更好的体验：`,
    '',
    ...prependBullets(toolPreferenceItems),
    `虽然 ${BASH_TOOL_NAME} 工具可以做类似的事情，但最好使用内置工具，因为它们提供更好的用户体验，并使审查工具调用和授予权限更加容易。`,
    '',
    '# 指令',
    ...prependBullets(instructionItems),
    getSimpleSandboxSection(),
    ...(getCommitAndPRInstructions() ? ['', getCommitAndPRInstructions()] : []),
  ].join('\n')
}
