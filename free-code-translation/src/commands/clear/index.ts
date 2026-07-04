import type { Command } from '../../commands.js'

const clear = {
  type: 'prompt',
  name: 'clear',
  aliases: ['cls'],
  description: '清除当前对话',
  contentLength: 0,
  progressMessage: '正在清除对话',
  source: 'builtin',
  async getPromptForCommand() {
    return '对话已清除。接下来我能帮您什么？'
  },
} satisfies Command

export default clear
