import type { Command } from '../../commands.js'

const exportCommand = {
  type: 'local-jsx',
  name: 'export',
  description: '将当前对话导出到文件或剪贴板',
  argumentHint: '[filename]',
  load: () => import('./export.js'),
} satisfies Command

export default exportCommand
