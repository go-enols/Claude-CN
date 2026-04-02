import { open, stat } from 'fs/promises'
import { CLAUDE_CODE_GUIDE_AGENT_TYPE } from 'src/tools/AgentTool/built-in/claudeCodeGuideAgent.js'
import { getSettingsFilePathForSource } from 'src/utils/settings/settings.js'
import { enableDebugLogging, getDebugLogPath } from '../../utils/debug.js'
import { errorMessage, isENOENT } from '../../utils/errors.js'
import { formatFileSize } from '../../utils/format.js'
import { registerBundledSkill } from '../bundledSkills.js'

const DEFAULT_DEBUG_LINES_READ = 20
const TAIL_READ_BYTES = 64 * 1024

export function registerDebugSkill(): void {
  registerBundledSkill({
    name: 'debug',
    description:
      process.env.USER_TYPE === 'ant'
        ? '通过读取会话调试日志来调试您当前的 Claude Code 会话。包含所有事件日志'
        : '为此会话启用调试日志记录并帮助诊断问题',
    allowedTools: ['Read', 'Grep', 'Glob'],
    argumentHint: '[issue description]',
    // disableModelInvocation，以便用户在交互模式下必须明确请求它，
    // 并且描述不会占用上下文。
    disableModelInvocation: true,
    userInvocable: true,
    async getPromptForCommand(args) {
      // 非 ant 默认不写调试日志 — 现在打开日志，以便
      // 此会话中的后续活动被捕获。
      const wasAlreadyLogging = enableDebugLogging()
      const debugLogPath = getDebugLogPath()

      let logInfo: string
      try {
        // 尾随读取日志而不读取整个内容 - 调试日志在长会话中无限增长，
        // 完整读取会导致 RSS 激增。
        const stats = await stat(debugLogPath)
        const readSize = Math.min(stats.size, TAIL_READ_BYTES)
        const startOffset = stats.size - readSize
        const fd = await open(debugLogPath, 'r')
        try {
          const { buffer, bytesRead } = await fd.read({
            buffer: Buffer.alloc(readSize),
            position: startOffset,
          })
          const tail = buffer
            .toString('utf-8', 0, bytesRead)
            .split('\n')
            .slice(-DEFAULT_DEBUG_LINES_READ)
            .join('\n')
          logInfo = `日志大小：${formatFileSize(stats.size)}\n\n### 最后 ${DEFAULT_DEBUG_LINES_READ} 行\n\n\`\`\`\n${tail}\n\`\`\``
        } finally {
          await fd.close()
        }
      } catch (e) {
        logInfo = isENOENT(e)
          ? '尚不存在调试日志 — 日志刚刚启用。'
          : `读取调试日志最后 ${DEFAULT_DEBUG_LINES_READ} 行失败：${errorMessage(e)}`
      }

      const justEnabledSection = wasAlreadyLogging
        ? ''
        : `
## 调试日志刚刚启用

此会话的调试日志之前是关闭的。在此 /debug 调用之前没有任何内容被捕获。

告诉用户调试日志现在在 \`${debugLogPath}\` 处于活动状态，让他们重现问题，然后重新读取日志。如果他们无法重现，也可以使用 \`claude --debug\` 重新启动以从启动时捕获日志。
`

      const prompt = `# 调试技能

帮助用户调试他们在当前 Claude Code 会话中遇到的问题。
${justEnabledSection}
## 会话调试日志

当前会话的调试日志位于：\`${debugLogPath}\`

${logInfo}

要获取额外上下文，请在整个文件中 grep [ERROR] 和 [WARN] 行。

## 问题描述

${args || '用户没有描述具体问题。读取调试日志并总结任何错误、警告或值得注意的问题。'}

## 设置

请记住，设置位于：
* user - ${getSettingsFilePathForSource('userSettings')}
* project - ${getSettingsFilePathForSource('projectSettings')}
* local - ${getSettingsFilePathForSource('localSettings')}

## 说明

1. 查看用户的问题描述
2. 最后 ${DEFAULT_DEBUG_LINES_READ} 行显示调试文件格式。查找 [ERROR] 和 [WARN] 条目、堆栈跟踪，以及整个文件中的失败模式
3. 考虑启动 ${CLAUDE_CODE_GUIDE_AGENT_TYPE} 子代理以了解相关的 Claude Code 功能
4. 用简单的语言解释你发现的内容
5. 建议具体的修复或后续步骤
`
      return [{ type: 'text', text: prompt }]
    },
  })
}