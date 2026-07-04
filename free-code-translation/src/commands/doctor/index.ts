import type { Command } from '../../commands.js'

const doctor = {
  type: 'local-jsx',
  name: 'doctor',
  description: '诊断安装中的常见问题',
  load: () => import('./doctor.js'),
} satisfies Command

export default doctor
