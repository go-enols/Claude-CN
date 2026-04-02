import chalk from 'chalk'
import { logForDebugging } from 'src/utils/debug.js'
import { fileHistoryEnabled } from 'src/utils/fileHistory.js'
import {
  getInitialSettings,
  getSettings_DEPRECATED,
  getSettingsForSource,
} from 'src/utils/settings/settings.js'
import { shouldOfferTerminalSetup } from '../../commands/terminalSetup/terminalSetup.js'
import { getDesktopUpsellConfig } from '../../components/DesktopUpsell/DesktopUpsellStartup.js'
import { color } from '../../components/design-system/color.js'
import { shouldShowOverageCreditUpsell } from '../../components/LogoV2/OverageCreditUpsell.js'
import { getShortcutDisplay } from '../../keybindings/shortcutFormat.js'
import { isKairosCronEnabled } from '../../tools/ScheduleCronTool/prompt.js'
import { is1PApiCustomer } from '../../utils/auth.js'
import { countConcurrentSessions } from '../../utils/concurrentSessions.js'
import { getGlobalConfig } from '../../utils/config.js'
import {
  getEffortEnvOverride,
  modelSupportsEffort,
} from '../../utils/effort.js'
import { env } from '../../utils/env.js'
import { cacheKeys } from '../../utils/fileStateCache.js'
import { getWorktreeCount } from '../../utils/git.js'
import {
  detectRunningIDEsCached,
  getSortedIdeLockfiles,
  isCursorInstalled,
  isSupportedTerminal,
  isSupportedVSCodeTerminal,
  isVSCodeInstalled,
  isWindsurfInstalled,
} from '../../utils/ide.js'
import {
  getMainLoopModel,
  getUserSpecifiedModelSetting,
} from '../../utils/model/model.js'
import { getPlatform } from '../../utils/platform.js'
import { isPluginInstalled } from '../../utils/plugins/installedPluginsManager.js'
import { loadKnownMarketplacesConfigSafe } from '../../utils/plugins/marketplaceManager.js'
import { OFFICIAL_MARKETPLACE_NAME } from '../../utils/plugins/officialMarketplace.js'
import {
  getCurrentSessionAgentColor,
  isCustomTitleEnabled,
} from '../../utils/sessionStorage.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../analytics/growthbook.js'
import {
  formatGrantAmount,
  getCachedOverageCreditGrant,
} from '../api/overageCreditGrant.js'
import {
  checkCachedPassesEligibility,
  formatCreditAmount,
  getCachedReferrerReward,
} from '../api/referral.js'
import { getSessionsSinceLastShown } from './tipHistory.js'
import type { Tip, TipContext } from './types.js'

let _isOfficialMarketplaceInstalledCache: boolean | undefined
async function isOfficialMarketplaceInstalled(): Promise<boolean> {
  if (_isOfficialMarketplaceInstalledCache !== undefined) {
    return _isOfficialMarketplaceInstalledCache
  }
  const config = await loadKnownMarketplacesConfigSafe()
  _isOfficialMarketplaceInstalledCache = OFFICIAL_MARKETPLACE_NAME in config
  return _isOfficialMarketplaceInstalledCache
}

async function isMarketplacePluginRelevant(
  pluginName: string,
  context: TipContext | undefined,
  signals: { filePath?: RegExp; cli?: string[] },
): Promise<boolean> {
  if (!(await isOfficialMarketplaceInstalled())) {
    return false
  }
  if (isPluginInstalled(`${pluginName}@${OFFICIAL_MARKETPLACE_NAME}`)) {
    return false
  }
  const { bashTools } = context ?? {}
  if (signals.cli && bashTools?.size) {
    if (signals.cli.some(cmd => bashTools.has(cmd))) {
      return true
    }
  }
  if (signals.filePath && context?.readFileState) {
    const readFiles = cacheKeys(context.readFileState)
    if (readFiles.some(fp => signals.filePath!.test(fp))) {
      return true
    }
  }
  return false
}

const externalTips: Tip[] = [
  {
    id: 'new-user-warmup',
    content: async () =>
      `从小功能或错误修复开始，让 Claude 提出计划，并验证其建议的编辑`,
    cooldownSessions: 3,
    async isRelevant() {
      const config = getGlobalConfig()
      return config.numStartups < 10
    },
  },
  {
    id: 'plan-mode-for-complex-tasks',
    content: async () =>
      `在进行更改之前使用计划模式为复杂请求做准备。按 ${getShortcutDisplay('chat:cycleMode', 'Chat', 'shift+tab')} 两次以启用。`,
    cooldownSessions: 5,
    isRelevant: async () => {
      if (process.env.USER_TYPE === 'ant') return false
      const config = getGlobalConfig()
      // Show to users who haven't used plan mode recently (7+ days)
      const daysSinceLastUse = config.lastPlanModeUse
        ? (Date.now() - config.lastPlanModeUse) / (1000 * 60 * 60 * 24)
        : Infinity
      return daysSinceLastUse > 7
    },
  },
  {
    id: 'default-permission-mode-config',
    content: async () =>
      `使用 /config 更改您的默认权限模式（包括计划模式）`,
    cooldownSessions: 10,
    isRelevant: async () => {
      try {
        const config = getGlobalConfig()
        const settings = getSettings_DEPRECATED()
        // Show if they've used plan mode but haven't set a default
        const hasUsedPlanMode = Boolean(config.lastPlanModeUse)
        const hasDefaultMode = Boolean(settings?.permissions?.defaultMode)
        return hasUsedPlanMode && !hasDefaultMode
      } catch (error) {
        logForDebugging(
          `Failed to check default-permission-mode-config tip relevance: ${error}`,
          { level: 'warn' },
        )
        return false
      }
    },
  },
  {
    id: 'git-worktrees',
    content: async () =>
      '使用 git worktrees 并行运行多个 Claude 会话。',
    cooldownSessions: 10,
    isRelevant: async () => {
      try {
        const config = getGlobalConfig()
        const worktreeCount = await getWorktreeCount()
        return worktreeCount <= 1 && config.numStartups > 50
      } catch (_) {
        return false
      }
    },
  },
  {
    id: 'color-when-multi-clauding',
    content: async () =>
      '正在运行多个 Claude 会话？使用 /color 和 /rename 一眼就能区分它们。',
    cooldownSessions: 10,
    isRelevant: async () => {
      if (getCurrentSessionAgentColor()) return false
      const count = await countConcurrentSessions()
      return count >= 2
    },
  },
  {
    id: 'terminal-setup',
    content: async () =>
      env.terminal === 'Apple_Terminal'
        ? '运行 /terminal-setup 以启用便捷的终端集成，如 Option + Enter 换行等功能'
        : '运行 /terminal-setup 以启用便捷的终端集成，如 Shift + Enter 换行等功能',
    cooldownSessions: 10,
    async isRelevant() {
      const config = getGlobalConfig()
      if (env.terminal === 'Apple_Terminal') {
        return !config.optionAsMetaKeyInstalled
      }
      return !config.shiftEnterKeyBindingInstalled
    },
  },
  {
    id: 'shift-enter',
    content: async () =>
      env.terminal === 'Apple_Terminal'
        ? '按 Option+Enter 发送多行消息'
        : '按 Shift+Enter 发送多行消息',
    cooldownSessions: 10,
    async isRelevant() {
      const config = getGlobalConfig()
      return Boolean(
        (env.terminal === 'Apple_Terminal'
          ? config.optionAsMetaKeyInstalled
          : config.shiftEnterKeyBindingInstalled) && config.numStartups > 3,
      )
    },
  },
  {
    id: 'shift-enter-setup',
    content: async () =>
      env.terminal === 'Apple_Terminal'
        ? '运行 /terminal-setup 以启用 Option+Enter 换行'
        : '运行 /terminal-setup 以启用 Shift+Enter 换行',
    cooldownSessions: 10,
    async isRelevant() {
      if (!shouldOfferTerminalSetup()) {
        return false
      }
      const config = getGlobalConfig()
      return !(env.terminal === 'Apple_Terminal'
        ? config.optionAsMetaKeyInstalled
        : config.shiftEnterKeyBindingInstalled)
    },
  },
  {
    id: 'memory-command',
    content: async () => '使用 /memory 查看和管理 Claude 记忆',
    cooldownSessions: 15,
    async isRelevant() {
      const config = getGlobalConfig()
      return config.memoryUsageCount <= 0
    },
  },
  {
    id: 'theme-command',
    content: async () => '使用 /theme 更改颜色主题',
    cooldownSessions: 20,
    isRelevant: async () => true,
  },
  {
    id: 'colorterm-truecolor',
    content: async () =>
      '尝试设置环境变量 COLORTERM=truecolor 以获得更丰富的颜色',
    cooldownSessions: 30,
    isRelevant: async () => !process.env.COLORTERM && chalk.level < 3,
  },
  {
    id: 'powershell-tool-env',
    content: async () =>
      '设置 CLAUDE_CODE_USE_POWERSHELL_TOOL=1 以启用 PowerShell 工具（预览版）',
    cooldownSessions: 10,
    isRelevant: async () =>
      getPlatform() === 'windows' &&
      process.env.CLAUDE_CODE_USE_POWERSHELL_TOOL === undefined,
  },
  {
    id: 'status-line',
    content: async () =>
      '使用 /statusline 设置自定义状态行，它将显示在输入框下方',
    cooldownSessions: 25,
    isRelevant: async () => getSettings_DEPRECATED().statusLine === undefined,
  },
  {
    id: 'prompt-queue',
    content: async () =>
      '在 Claude 工作时按 Enter 键排队发送额外的消息。',
    cooldownSessions: 5,
    async isRelevant() {
      const config = getGlobalConfig()
      return config.promptQueueUseCount <= 3
    },
  },
  {
    id: 'enter-to-steer-in-relatime',
    content: async () =>
      '在 Claude 工作时发送消息以实时引导 Claude',
    cooldownSessions: 20,
    isRelevant: async () => true,
  },
  {
    id: 'todo-list',
    content: async () =>
      '在处理复杂任务时请 Claude 创建待办事项列表以跟踪进度并保持正轨',
    cooldownSessions: 20,
    isRelevant: async () => true,
  },
  {
    id: 'vscode-command-install',
    content: async () =>
      `打开命令面板 (Cmd+Shift+P) 并运行 "Shell Command: Install '${env.terminal === 'vscode' ? 'code' : env.terminal}' command in PATH" 以启用 IDE 集成`,
    cooldownSessions: 0,
    async isRelevant() {
      // Only show this tip if we're in a VS Code-style terminal
      if (!isSupportedVSCodeTerminal()) {
        return false
      }
      if (getPlatform() !== 'macos') {
        return false
      }

      // Check if the relevant command is available
      switch (env.terminal) {
        case 'vscode':
          return !(await isVSCodeInstalled())
        case 'cursor':
          return !(await isCursorInstalled())
        case 'windsurf':
          return !(await isWindsurfInstalled())
        default:
          return false
      }
    },
  },
  {
    id: 'ide-upsell-external-terminal',
    content: async () => '将 Claude 连接到您的 IDE · /ide',
    cooldownSessions: 4,
    async isRelevant() {
      if (isSupportedTerminal()) {
        return false
      }

      // Use lockfiles as a (quicker) signal for running IDEs
      const lockfiles = await getSortedIdeLockfiles()
      if (lockfiles.length !== 0) {
        return false
      }

      const runningIDEs = await detectRunningIDEsCached()
      return runningIDEs.length > 0
    },
  },
  {
    id: 'install-github-app',
    content: async () =>
      '运行 /install-github-app 以在您的 Github 问题和 PR 中直接标记 @claude',
    cooldownSessions: 10,
    isRelevant: async () => !getGlobalConfig().githubActionSetupCount,
  },
  {
    id: 'install-slack-app',
    content: async () => '运行 /install-slack-app 以在 Slack 中使用 Claude',
    cooldownSessions: 10,
    isRelevant: async () => !getGlobalConfig().slackAppInstallCount,
  },
  {
    id: 'permissions',
    content: async () =>
      '使用 /permissions 预先批准和预先拒绝 bash、edit 和 MCP 工具',
    cooldownSessions: 10,
    async isRelevant() {
      const config = getGlobalConfig()
      return config.numStartups > 10
    },
  },
  {
    id: 'drag-and-drop-images',
    content: async () =>
      '您知道可以将图像文件拖放到终端中吗？',
    cooldownSessions: 10,
    isRelevant: async () => !env.isSSH(),
  },
  {
    id: 'paste-images-mac',
    content: async () =>
      '使用 control+v（不是 cmd+v！）将图像粘贴到 Claude Code 中',
    cooldownSessions: 10,
    isRelevant: async () => getPlatform() === 'macos',
  },
  {
    id: 'double-esc',
    content: async () =>
      '双击 esc 将对话倒回到之前的某个时间点',
    cooldownSessions: 10,
    isRelevant: async () => !fileHistoryEnabled(),
  },
  {
    id: 'double-esc-code-restore',
    content: async () =>
      '双击 esc 将代码和/或对话倒回到之前的某个时间点',
    cooldownSessions: 10,
    isRelevant: async () => fileHistoryEnabled(),
  },
  {
    id: 'continue',
    content: async () =>
      '运行 claude --continue 或 claude --resume 以恢复对话',
    cooldownSessions: 10,
    isRelevant: async () => true,
  },
  {
    id: 'rename-conversation',
    content: async () =>
      '使用 /rename 命名您的对话，以便稍后通过 /resume 轻松找到它们',
    cooldownSessions: 15,
    isRelevant: async () =>
      isCustomTitleEnabled() && getGlobalConfig().numStartups > 10,
  },
  {
    id: 'custom-commands',
    content: async () =>
      '通过将 .md 文件添加到项目中的 .claude/skills/ 或 ~/.claude/skills/ 来创建技能，以便在任何项目中使用',
    cooldownSessions: 15,
    async isRelevant() {
      const config = getGlobalConfig()
      return config.numStartups > 10
    },
  },
  {
    id: 'shift-tab',
    content: async () =>
      process.env.USER_TYPE === 'ant'
        ? `按 ${getShortcutDisplay('chat:cycleMode', 'Chat', 'shift+tab')} 在默认模式和自动模式之间切换`
        : `按 ${getShortcutDisplay('chat:cycleMode', 'Chat', 'shift+tab')} 在默认模式、自动接受编辑模式和计划模式之间切换`,
    cooldownSessions: 10,
    isRelevant: async () => true,
  },
  {
    id: 'image-paste',
    content: async () =>
      `使用 ${getShortcutDisplay('chat:imagePaste', 'Chat', 'ctrl+v')} 从剪贴板粘贴图像`,
    cooldownSessions: 20,
    isRelevant: async () => true,
  },
  {
    id: 'custom-agents',
    content: async () =>
      '使用 /agents 优化特定任务。例如：软件架构师、代码编写者、代码审查者',
    cooldownSessions: 15,
    async isRelevant() {
      const config = getGlobalConfig()
      return config.numStartups > 5
    },
  },
  {
    id: 'agent-flag',
    content: async () =>
      '使用 --agent <agent_name> 直接与子代理开始对话',
    cooldownSessions: 15,
    async isRelevant() {
      const config = getGlobalConfig()
      return config.numStartups > 5
    },
  },
  {
    id: 'desktop-app',
    content: async () =>
      '使用 Claude 桌面应用在本地或远程运行 Claude Code：clau.de/desktop',
    cooldownSessions: 15,
    isRelevant: async () => getPlatform() !== 'linux',
  },
  {
    id: 'desktop-shortcut',
    content: async ctx => {
      const blue = color('suggestion', ctx.theme)
      return `使用 ${blue('/desktop')} 在 Claude Code 桌面版中继续您的会话`
    },
    cooldownSessions: 15,
    isRelevant: async () => {
      if (!getDesktopUpsellConfig().enable_shortcut_tip) return false
      return (
        process.platform === 'darwin' ||
        (process.platform === 'win32' && process.arch === 'x64')
      )
    },
  },
  {
    id: 'web-app',
    content: async () =>
      '在本地继续编码的同时在云端运行任务 · clau.de/web',
    cooldownSessions: 15,
    isRelevant: async () => true,
  },
  {
    id: 'mobile-app',
    content: async () =>
      '使用 /mobile 从手机上的 Claude 应用使用 Claude Code',
    cooldownSessions: 15,
    isRelevant: async () => true,
  },
  {
    id: 'opusplan-mode-reminder',
    content: async () =>
      `您的默认模型设置是 Opus 计划模式。按 ${getShortcutDisplay('chat:cycleMode', 'Chat', 'shift+tab')} 两次以激活计划模式并与 Claude Opus 一起计划。`,
    cooldownSessions: 2,
    async isRelevant() {
      if (process.env.USER_TYPE === 'ant') return false
      const config = getGlobalConfig()
      const modelSetting = getUserSpecifiedModelSetting()
      const hasOpusPlanMode = modelSetting === 'opusplan'
      // Show reminder if they have Opus Plan Mode and haven't used plan mode recently (3+ days)
      const daysSinceLastUse = config.lastPlanModeUse
        ? (Date.now() - config.lastPlanModeUse) / (1000 * 60 * 60 * 24)
        : Infinity
      return hasOpusPlanMode && daysSinceLastUse > 3
    },
  },
  {
    id: 'frontend-design-plugin',
    content: async ctx => {
      const blue = color('suggestion', ctx.theme)
      return `正在使用 HTML/CSS？安装前端设计插件：\n${blue(`/plugin install frontend-design@${OFFICIAL_MARKETPLACE_NAME}`)}`
    },
    cooldownSessions: 3,
    isRelevant: async context =>
      isMarketplacePluginRelevant('frontend-design', context, {
        filePath: /\.(html|css|htm)$/i,
      }),
  },
  {
    id: 'vercel-plugin',
    content: async ctx => {
      const blue = color('suggestion', ctx.theme)
      return `正在使用 Vercel？安装 vercel 插件：\n${blue(`/plugin install vercel@${OFFICIAL_MARKETPLACE_NAME}`)}`
    },
    cooldownSessions: 3,
    isRelevant: async context =>
      isMarketplacePluginRelevant('vercel', context, {
        filePath: /(?:^|[/\\])vercel\.json$/i,
        cli: ['vercel'],
      }),
  },
  {
    id: 'effort-high-nudge',
    content: async ctx => {
      const blue = color('suggestion', ctx.theme)
      const cmd = blue('/effort high')
      const variant = getFeatureValue_CACHED_MAY_BE_STALE<
        'off' | 'copy_a' | 'copy_b'
      >('tengu_tide_elm', 'off')
      return variant === 'copy_b'
        ? `使用 ${cmd} 获得更好的一次性答案。Claude 会先仔细思考。`
        : `正在处理棘手的问题？${cmd} 提供更好的首次答案`
    },
    cooldownSessions: 3,
    isRelevant: async () => {
      if (!is1PApiCustomer()) return false
      if (!modelSupportsEffort(getMainLoopModel())) return false
      if (getSettingsForSource('policySettings')?.effortLevel !== undefined) {
        return false
      }
      if (getEffortEnvOverride() !== undefined) return false
      const persisted = getInitialSettings().effortLevel
      if (persisted === 'high' || persisted === 'max') return false
      return (
        getFeatureValue_CACHED_MAY_BE_STALE<'off' | 'copy_a' | 'copy_b'>(
          'tengu_tide_elm',
          'off',
        ) !== 'off'
      )
    },
  },
  {
    id: 'subagent-fanout-nudge',
    content: async ctx => {
      const blue = color('suggestion', ctx.theme)
      const variant = getFeatureValue_CACHED_MAY_BE_STALE<
        'off' | 'copy_a' | 'copy_b'
      >('tengu_tern_alloy', 'off')
      return variant === 'copy_b'
        ? `对于大任务，告诉 Claude ${blue('使用子代理')}。它们并行工作，保持您的主线程整洁。`
        : `说 ${blue('"fan out subagents"')}，Claude 会派遣一个团队。每个都深入挖掘，确保不会遗漏任何内容。`
    },
    cooldownSessions: 3,
    isRelevant: async () => {
      if (!is1PApiCustomer()) return false
      return (
        getFeatureValue_CACHED_MAY_BE_STALE<'off' | 'copy_a' | 'copy_b'>(
          'tengu_tern_alloy',
          'off',
        ) !== 'off'
      )
    },
  },
  {
    id: 'loop-command-nudge',
    content: async ctx => {
      const blue = color('suggestion', ctx.theme)
      const variant = getFeatureValue_CACHED_MAY_BE_STALE<
        'off' | 'copy_a' | 'copy_b'
      >('tengu_timber_lark', 'off')
      return variant === 'copy_b'
        ? `使用 ${blue('/loop 5m check the deploy')} 按计划运行任何提示。设置好就不用管了。`
        : `${blue('/loop')} 按计划循环运行任何提示。非常适合监控部署、看护 PR 或轮询状态。`
    },
    cooldownSessions: 3,
    isRelevant: async () => {
      if (!is1PApiCustomer()) return false
      if (!isKairosCronEnabled()) return false
      return (
        getFeatureValue_CACHED_MAY_BE_STALE<'off' | 'copy_a' | 'copy_b'>(
          'tengu_timber_lark',
          'off',
        ) !== 'off'
      )
    },
  },
  {
    id: 'guest-passes',
    content: async ctx => {
      const claude = color('claude', ctx.theme)
      const reward = getCachedReferrerReward()
      return reward
        ? `分享 Claude Code 并赚取 ${claude(formatCreditAmount(reward))} 的额外使用量 · ${claude('/passes')}`
        : `您有免费的访客通行证可以分享 · ${claude('/passes')}`
    },
    cooldownSessions: 3,
    isRelevant: async () => {
      const config = getGlobalConfig()
      if (config.hasVisitedPasses) {
        return false
      }
      const { eligible } = checkCachedPassesEligibility()
      return eligible
    },
  },
  {
    id: 'overage-credit',
    content: async ctx => {
      const claude = color('claude', ctx.theme)
      const info = getCachedOverageCreditGrant()
      const amount = info ? formatGrantAmount(info) : null
      if (!amount) return ''
      // Copy from "OC & Bulk Overages copy" doc (#5 — CLI Rotating tip)
      return `${claude(`${amount} 的额外使用量，我们提供`)} · 第三方应用 · ${claude('/extra-usage')}`
    },
    cooldownSessions: 3,
    isRelevant: async () => shouldShowOverageCreditUpsell(),
  },
  {
    id: 'feedback-command',
    content: async () => '使用 /feedback 帮助我们改进！',
    cooldownSessions: 15,
    async isRelevant() {
      if (process.env.USER_TYPE === 'ant') {
        return false
      }
      const config = getGlobalConfig()
      return config.numStartups > 5
    },
  },
]
const internalOnlyTips: Tip[] =
  process.env.USER_TYPE === 'ant'
    ? [
        {
          id: 'important-claudemd',
          content: async () =>
            '[ANT-ONLY] 使用 "IMPORTANT:" 前缀表示必须遵循的 CLAUDE.md 规则',
          cooldownSessions: 30,
          isRelevant: async () => true,
        },
        {
          id: 'skillify',
          content: async () =>
            '[ANT-ONLY] 在工作流程结束时使用 /skillify 将其转换为可重用的技能',
          cooldownSessions: 15,
          isRelevant: async () => true,
        },
      ]
    : []

function getCustomTips(): Tip[] {
  const settings = getInitialSettings()
  const override = settings.spinnerTipsOverride
  if (!override?.tips?.length) return []

  return override.tips.map((content, i) => ({
    id: `custom-tip-${i}`,
    content: async () => content,
    cooldownSessions: 0,
    isRelevant: async () => true,
  }))
}

export async function getRelevantTips(context?: TipContext): Promise<Tip[]> {
  const settings = getInitialSettings()
  const override = settings.spinnerTipsOverride
  const customTips = getCustomTips()

  // If excludeDefault is true and there are custom tips, skip built-in tips entirely
  if (override?.excludeDefault && customTips.length > 0) {
    return customTips
  }

  // Otherwise, filter built-in tips as before and combine with custom
  const tips = [...externalTips, ...internalOnlyTips]
  const isRelevant = await Promise.all(tips.map(_ => _.isRelevant(context)))
  const filtered = tips
    .filter((_, index) => isRelevant[index])
    .filter(_ => getSessionsSinceLastShown(_.id) >= _.cooldownSessions)

  return [...filtered, ...customTips]
}
