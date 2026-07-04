import type { Command } from '../../commands.js'

const version = {
  type: 'prompt',
  name: 'version',
  description: '显示当前版本',
  contentLength: 0,
  progressMessage: '正在检查版本',
  source: 'builtin',
  async getPromptForCommand() {
    return `当前版本是 ${MACRO.VERSION}`
  },
} satisfies Command

export default version
