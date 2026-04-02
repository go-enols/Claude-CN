import type { Command } from '../../commands.js'

const resume: Command = {
  type: 'local-jsx',
  name: 'resume',
  description: '恢复之前的会话',
  aliases: ['continue'],
  argumentHint: '[conversation id or search term]',
  load: () => import('./resume.js'),
}

export default resume
