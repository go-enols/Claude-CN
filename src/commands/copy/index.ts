/**
 * Copy command - minimal metadata only.
 * Implementation is lazy-loaded from copy.tsx to reduce startup time.
 */
import type { Command } from '../../commands.js'

const copy = {
  type: 'local-jsx',
  name: 'copy',
  description:
    '将 Claude 的最新响应复制到剪贴板（或 /copy N 复制倒数第 N 条）',
  load: () => import('./copy.js'),
} satisfies Command

export default copy

