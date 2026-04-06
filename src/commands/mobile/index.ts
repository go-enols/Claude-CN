import type { Command } from '../../commands.js'

const mobile = {
  type: 'local-jsx',
  name: 'mobile',
  aliases: ['ios', 'android'],
  description: '显示二维码以下载 Claude 手机应用',
  load: () => import('./mobile.js'),
} satisfies Command

export default mobile

