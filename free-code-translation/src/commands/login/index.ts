import type { Command } from '../../commands.js'

const login = {
  type: 'local-jsx',
  name: 'login',
  description: '登录您的账户',
  aliases: ['auth'],
  load: () => import('./login.js'),
} satisfies Command

export default login
