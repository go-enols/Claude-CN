/**
 * 集中式速率限制消息生成
 * 所有速率限制相关消息的真实单一来源
 */

import {
  getOauthAccountInfo,
  getSubscriptionType,
  isOverageProvisioningAllowed,
} from '../utils/auth.js'
import { hasClaudeAiBillingAccess } from '../utils/billing.js'
import { formatResetTime } from '../utils/format.js'
import type { ClaudeAILimits } from './claudeAiLimits.js'

const FEEDBACK_CHANNEL_ANT = '#briarpatch-cc'

/**
 * 所有可能的速率限制错误消息前缀
 * 导出此以避免 UI 组件中的脆弱字符串匹配
 */
export const RATE_LIMIT_ERROR_PREFIXES = [
  '您已达到',
  '您已使用',
  '您现在正在使用额外使用',
  '您接近',
  '您的额外使用已用完',
] as const

/**
 * 检查消息是否为速率限制错误
 */
export function isRateLimitErrorMessage(text: string): boolean {
  return RATE_LIMIT_ERROR_PREFIXES.some(prefix => text.startsWith(prefix))
}

export type RateLimitMessage = {
  message: string
  severity: 'error' | 'warning'
}

/**
 * 根据限制状态获取适当的速率限制消息
 * 如果不应显示消息则返回 null
 */
export function getRateLimitMessage(
  limits: ClaudeAILimits,
  model: string,
): RateLimitMessage | null {
  // 首先检查超量场景（当订阅被拒绝但超量可用时）
  // getUsingOverageText 与警告分开渲染。
  if (limits.isUsingOverage) {
    // 如果接近超量支出限制则显示警告
    if (limits.overageStatus === 'allowed_warning') {
      return {
        message: '您接近额外使用支出限制',
        severity: 'warning',
      }
    }
    return null
  }

  // 错误状态 - 当限制被拒绝时
  if (limits.status === 'rejected') {
    return { message: getLimitReachedText(limits, model), severity: 'error' }
  }

  // 警告状态 - 当接近限制并有早期警告时
  if (limits.status === 'allowed_warning') {
    // 仅当利用率高于阈值（70%）时显示警告
    // 这可以防止一周重置后 API 发送带有低使用率的
    // allowed_warning 时出现虚假警告
    const WARNING_THRESHOLD = 0.7
    if (
      limits.utilization !== undefined &&
      limits.utilization < WARNING_THRESHOLD
    ) {
      return null
    }

    // 如果启用超量，不要向非计费的 Team/Enterprise 用户警告接近计划限制
    // - 他们将无缝进入超量
    const subscriptionType = getSubscriptionType()
    const isTeamOrEnterprise =
      subscriptionType === 'team' || subscriptionType === 'enterprise'
    const hasExtraUsageEnabled =
      getOauthAccountInfo()?.hasExtraUsageEnabled === true

    if (
      isTeamOrEnterprise &&
      hasExtraUsageEnabled &&
      !hasClaudeAiBillingAccess()
    ) {
      return null
    }

    const text = getEarlyWarningText(limits)
    if (text) {
      return { message: text, severity: 'warning' }
    }
  }

  // 不需要消息
  return null
}

/**
 * 获取 API 错误的错误消息（用于 errors.ts）
 * 返回消息字符串，如果不显示错误消息则返回 null
 */
export function getRateLimitErrorMessage(
  limits: ClaudeAILimits,
  model: string,
): string | null {
  const message = getRateLimitMessage(limits, model)

  // 仅返回错误消息，不返回警告
  if (message && message.severity === 'error') {
    return message.message
  }

  return null
}

/**
 * 获取 UI 页脚的警告消息
 * 如果不应显示警告则返回警告消息字符串或 null
 */
export function getRateLimitWarning(
  limits: ClaudeAILimits,
  model: string,
): string | null {
  const message = getRateLimitMessage(limits, model)

  // 仅返回页脚的警告 - 错误显示在 AssistantTextMessages 中
  if (message && message.severity === 'warning') {
    return message.message
  }

  // 不要在页脚显示错误
  return null
}

function getLimitReachedText(limits: ClaudeAILimits, model: string): string {
  const resetsAt = limits.resetsAt
  const resetTime = resetsAt ? formatResetTime(resetsAt, true) : undefined
  const overageResetTime = limits.overageResetsAt
    ? formatResetTime(limits.overageResetsAt, true)
    : undefined
  const resetMessage = resetTime ? ` · 重置于 ${resetTime}` : ''

  // 如果订阅（在此方法之前检查）和超量都耗尽
  if (limits.overageStatus === 'rejected') {
    // 显示最早的重置时间以指示用户何时可以恢复
    let overageResetMessage = ''
    if (resetsAt && limits.overageResetsAt) {
      // 两个时间戳都存在 - 使用较早的一个
      if (resetsAt < limits.overageResetsAt) {
        overageResetMessage = ` · 重置于 ${resetTime}`
      } else {
        overageResetMessage = ` · 重置于 ${overageResetTime}`
      }
    } else if (resetTime) {
      overageResetMessage = ` · 重置于 ${resetTime}`
    } else if (overageResetTime) {
      overageResetMessage = ` · 重置于 ${overageResetTime}`
    }

    if (limits.overageDisabledReason === 'out_of_credits') {
      return `您的额外使用已用完${overageResetMessage}`
    }

    return formatLimitReachedText('限制', overageResetMessage, model)
  }

  if (limits.rateLimitType === 'seven_day_sonnet') {
    const subscriptionType = getSubscriptionType()
    const isProOrEnterprise =
      subscriptionType === 'pro' || subscriptionType === 'enterprise'
    // 对于 pro 和 enterprise，Sonnet 限制与每周相同
    const limit = isProOrEnterprise ? '每周限制' : 'Sonnet 限制'
    return formatLimitReachedText(limit, resetMessage, model)
  }

  if (limits.rateLimitType === 'seven_day_opus') {
    return formatLimitReachedText('Opus 限制', resetMessage, model)
  }

  if (limits.rateLimitType === 'seven_day') {
    return formatLimitReachedText('每周限制', resetMessage, model)
  }

  if (limits.rateLimitType === 'five_hour') {
    return formatLimitReachedText('会话限制', resetMessage, model)
  }

  return formatLimitReachedText('使用限制', resetMessage, model)
}

function getEarlyWarningText(limits: ClaudeAILimits): string | null {
  let limitName: string | null = null
  switch (limits.rateLimitType) {
    case 'seven_day':
      limitName = '每周限制'
      break
    case 'five_hour':
      limitName = '会话限制'
      break
    case 'seven_day_opus':
      limitName = 'Opus 限制'
      break
    case 'seven_day_sonnet':
      limitName = 'Sonnet 限制'
      break
    case 'overage':
      limitName = '额外使用'
      break
    case undefined:
      return null
  }

  // 利用率和 resetsAt 应该被定义，因为早期警告是用它们计算的
  const used = limits.utilization
    ? Math.floor(limits.utilization * 100)
    : undefined
  const resetTime = limits.resetsAt
    ? formatResetTime(limits.resetsAt, true)
    : undefined

  // 根据订阅类型和限制类型获取追加销售命令
  const upsell = getWarningUpsellText(limits.rateLimitType)

  if (used && resetTime) {
    const base = `您已使用 ${limitName} 的 ${used}% · 重置于 ${resetTime}`
    return upsell ? `${base} · ${upsell}` : base
  }

  if (used) {
    const base = `您已使用 ${limitName} 的 ${used}%`
    return upsell ? `${base} · ${upsell}` : base
  }

  if (limits.rateLimitType === 'overage') {
    // 对于"接近 <x>"的措辞，"额外使用限制"比"额外使用"更有意义
    limitName += ' 限制'
  }

  if (resetTime) {
    const base = `接近 ${limitName} · 重置于 ${resetTime}`
    return upsell ? `${base} · ${upsell}` : base
  }

  const base = `接近 ${limitName}`
  return upsell ? `${base} · ${upsell}` : base
}

/**
 * 根据订阅和限制类型获取警告消息的追加销售命令文本。
 * 如果不应显示追加销售则返回 null。
 * 仅用于警告，因为实际的速率限制 hits 将看到交互式选项菜单。
 */
function getWarningUpsellText(
  rateLimitType: ClaudeAILimits['rateLimitType'],
): string | null {
  const subscriptionType = getSubscriptionType()
  const hasExtraUsageEnabled =
    getOauthAccountInfo()?.hasExtraUsageEnabled === true

  // 5 小时会话限制警告
  if (rateLimitType === 'five_hour') {
    // 禁用超量的 Teams/Enterprise：提示请求额外使用
    // 仅在允许为此组织类型配置超量时显示（例如，非 AWS 市场）
    if (subscriptionType === 'team' || subscriptionType === 'enterprise') {
      if (!hasExtraUsageEnabled && isOverageProvisioningAllowed()) {
        return '/extra-usage 请求更多'
      }
      // 启用超量的 Teams/Enterprise 或不支持的计费类型不需要追加销售
      return null
    }

    // Pro/Max 用户：提示升级
    if (subscriptionType === 'pro' || subscriptionType === 'max') {
      return '/upgrade 继续使用 Claude Code'
    }
  }

  // 超量警告（接近支出限制）
  if (rateLimitType === 'overage') {
    if (subscriptionType === 'team' || subscriptionType === 'enterprise') {
      if (!hasExtraUsageEnabled && isOverageProvisioningAllowed()) {
        return '/extra-usage 请求更多'
      }
    }
  }

  // 每周限制警告不显示追加销售（按规范）
  return null
}

/**
 * 获取超量模式转换的通知文本
 * 进入超量模式时用于临时通知
 */
export function getUsingOverageText(limits: ClaudeAILimits): string {
  const resetTime = limits.resetsAt
    ? formatResetTime(limits.resetsAt, true)
    : ''

  let limitName = ''
  if (limits.rateLimitType === 'five_hour') {
    limitName = '会话限制'
  } else if (limits.rateLimitType === 'seven_day') {
    limitName = '每周限制'
  } else if (limits.rateLimitType === 'seven_day_opus') {
    limitName = 'Opus 限制'
  } else if (limits.rateLimitType === 'seven_day_sonnet') {
    const subscriptionType = getSubscriptionType()
    const isProOrEnterprise =
      subscriptionType === 'pro' || subscriptionType === 'enterprise'
    // 对于 pro 和 enterprise，Sonnet 限制与每周相同
    limitName = isProOrEnterprise ? '每周限制' : 'Sonnet 限制'
  }

  if (!limitName) {
    return '现在使用额外使用'
  }

  const resetMessage = resetTime
    ? ` · 您的 ${limitName} 重置于 ${resetTime}`
    : ''
  return `您现在正在使用额外使用${resetMessage}`
}

function formatLimitReachedText(
  limit: string,
  resetMessage: string,
  _model: string,
): string {
  // 为 Ant 用户增强消息
  if (process.env.USER_TYPE === 'ant') {
    return `您已达到您的 ${limit}${resetMessage}。如果您有关于此限制的反馈，请发布在 ${FEEDBACK_CHANNEL_ANT}。您可以使用 /reset-limits 重置您的限制`
  }

  return `您已达到您的 ${limit}${resetMessage}`
}
