import type { Command } from '../../commands.js'

const exit = {
  type: 'prompt',
  name: 'exit',
  aliases: ['quit', 'q'],
  description: '退出应用程序',
  contentLength: 0,
  progressMessage: '正在退出',
  source: 'builtin',
  async getPromptForCommand() {
    return '再见！'
  },
} satisfies Command

export default exit
