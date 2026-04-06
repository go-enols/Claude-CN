/**
 * Color command - minimal metadata only.
 * Implementation is lazy-loaded from color.ts to reduce startup time.
 */
import type { Command } from '../../commands.js'

const color = {
  type: 'local-jsx',
  name: 'color',
  description: '设置本次会话的输入栏颜色',
  immediate: true,
  argumentHint: '<颜色|默认>',
  load: () => import('./color.js'),
} satisfies Command

export default color

