/**
 * Color command - minimal metadata only.
 * Implementation is lazy-loaded from color.ts to reduce startup time.
 */
import type { Command } from '../../commands.js'

const color = {
  type: 'local-jsx',
  name: 'color',
  description: '为此会话设置提示栏颜色',
  immediate: true,
  argumentHint: '<color|default>',
  load: () => import('./color.js'),
} satisfies Command

export default color
