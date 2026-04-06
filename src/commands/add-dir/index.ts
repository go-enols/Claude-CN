import type { Command } from '../../commands.js'

const addDir = {
  type: 'local-jsx',
  name: 'add-dir',
  description: '添加新的工作目录',
  argumentHint: '<路径>',
  load: () => import('./add-dir.js'),
} satisfies Command

export default addDir

