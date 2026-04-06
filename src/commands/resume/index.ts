import type { Command } from '../../commands.js'

const resume: Command = {
  type: 'local-jsx',
  name: 'resume',
  description: '继续之前的对话',
  aliases: ['continue'],
  argumentHint: '[对话 ID 或搜索词]',
  load: () => import('./resume.js'),
}

export default resume

