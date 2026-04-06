import type { Command } from '../../commands.js'

const exit = {
  type: 'local-jsx',
  name: 'exit',
  aliases: ['quit'],
  description: '退出交互界面',
  immediate: true,
  load: () => import('./exit.js'),
} satisfies Command

export default exit

