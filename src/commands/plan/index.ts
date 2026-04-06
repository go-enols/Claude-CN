import type { Command } from '../../commands.js'

const plan = {
  type: 'local-jsx',
  name: 'plan',
  description: '启用计划模式或查看当前会话计划',
  argumentHint: '[打开|<描述>]',
  load: () => import('./plan.js'),
} satisfies Command

export default plan

