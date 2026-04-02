import { BASE_CHROME_PROMPT } from '../../utils/claudeInChrome/prompt.js'
import { getChromeBrowserTools } from '../../utils/claudeInChrome/package.js'
import { shouldAutoEnableClaudeInChrome } from '../../utils/claudeInChrome/setup.js'
import { registerBundledSkill } from '../bundledSkills.js'

const SKILL_ACTIVATION_MESSAGE = `
现在此技能已调用，您可以访问 Chrome 浏览器自动化工具。您现在可以使用 mcp__claude-in-chrome__* 工具与网页交互。

重要：首先调用 mcp__claude-in-chrome__tabs_context_mcp 获取有关用户当前浏览器标签页的信息。
`

export function registerClaudeInChromeSkill(): void {
  const allowedTools = getChromeBrowserTools().map(
    tool => `mcp__claude-in-chrome__${tool.name}`,
  )

  registerBundledSkill({
    name: 'claude-in-chrome',
    description:
      '自动化您的 Chrome 浏览器与网页交互 — 点击元素、填写表单、捕获截图、读取控制台日志和导航网站。在现有 Chrome 会话的新标签页中打开页面。执行前需要站点级权限（在扩展中配置）。',
    whenToUse:
      '当用户想要与网页交互、自动化浏览器任务、捕获截图、读取控制台日志或执行任何基于浏览器的操作时。在尝试使用任何 mcp__claude-in-chrome__* 工具之前始终调用。',
    allowedTools,
    userInvocable: true,
    isEnabled: () => shouldAutoEnableClaudeInChrome(),
    async getPromptForCommand(args) {
      let prompt = `${BASE_CHROME_PROMPT}\n${SKILL_ACTIVATION_MESSAGE}`
      if (args) {
        prompt += `\n## 任务\n\n${args}`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}