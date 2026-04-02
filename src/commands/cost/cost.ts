import { formatTotalCost } from '../../cost-tracker.js'
import { currentLimits } from '../../services/claudeAiLimits.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isClaudeAISubscriber } from '../../utils/auth.js'

export const call: LocalCommandCall = async () => {
  if (isClaudeAISubscriber()) {
    let value: string

    if (currentLimits.isUsingOverage) {
      value =
        '您当前正在使用超额额度来支持 Claude Code 的使用。当订阅限额重置时，我们将自动切换回您的订阅限额'
    } else {
      value =
        '您当前正在使用订阅来支持 Claude Code 的使用'
    }

    if (process.env.USER_TYPE === 'ant') {
      value += `\n\n[ANT 专属] 仍显示费用：\n ${formatTotalCost()}`
    }
    return { type: 'text', value }
  }
  return { type: 'text', value: formatTotalCost() }
}
