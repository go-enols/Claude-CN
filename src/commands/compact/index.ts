import type { Command } from '../../commands.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

const compact = {
  type: 'local',
  name: 'compact',
  description:
    '清除对话历史但保留摘要在上下文中。可选参数：/compact [摘要化指令]',
  isEnabled: () => !isEnvTruthy(process.env.DISABLE_COMPACT),
  supportsNonInteractive: true,
  argumentHint: '<可选的自定义摘要化指令>',
  load: () => import('./compact.js'),
} satisfies Command

export default compact

