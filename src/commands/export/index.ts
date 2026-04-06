import type { Command } from '../../commands.js'

const exportCommand = {
  type: 'local-jsx',
  name: 'export',
  description: '将当前对话导出为文件或复制到剪贴板',
  argumentHint: '[文件名]',
  load: () => import('./export.js'),
} satisfies Command

export default exportCommand

