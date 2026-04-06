import type { Command } from '../../commands.js'

const btw = {
  type: 'local-jsx',
  name: 'btw',
  description:
    '提出一个不影响主对话的快速问题',
  immediate: true,
  argumentHint: '<问题>',
  load: () => import('./btw.js'),
} satisfies Command

export default btw

