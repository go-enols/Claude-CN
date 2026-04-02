import type { Command } from '../../commands.js'

const permissions = {
  type: 'local-jsx',
  name: 'permissions',
  aliases: ['allowed-tools'],
  description: '管理允许和拒绝工具权限规则',
  load: () => import('./permissions.js'),
} satisfies Command

export default permissions
