import {
  checkAdminRequestEligibility,
  createAdminRequest,
  getMyAdminRequests,
} from '../../services/api/adminRequests.js'
import { invalidateOverageCreditGrantCache } from '../../services/api/overageCreditGrant.js'
import { type ExtraUsage, fetchUtilization } from '../../services/api/usage.js'
import { getSubscriptionType } from '../../utils/auth.js'
import { hasClaudeAiBillingAccess } from '../../utils/billing.js'
import { openBrowser } from '../../utils/browser.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { logError } from '../../utils/log.js'

type ExtraUsageResult =
  | { type: 'message'; value: string }
  | { type: 'browser-opened'; url: string; opened: boolean }

export async function runExtraUsage(): Promise<ExtraUsageResult> {
  if (!getGlobalConfig().hasVisitedExtraUsage) {
    saveGlobalConfig(prev => ({ ...prev, hasVisitedExtraUsage: true }))
  }
  // Invalidate only the current org's entry so a follow-up read refetches
  // the granted state. Separate from the visited flag since users may run
  // /extra-usage more than once while iterating on the claim flow.
  invalidateOverageCreditGrantCache()

  const subscriptionType = getSubscriptionType()
  const isTeamOrEnterprise =
    subscriptionType === 'team' || subscriptionType === 'enterprise'
  const hasBillingAccess = hasClaudeAiBillingAccess()

  if (!hasBillingAccess && isTeamOrEnterprise) {
    // Mirror apps/claude-ai useHasUnlimitedOverage(): if overage is enabled
    // with no monthly cap, there is nothing to request. On fetch error, fall
    // through and let the user ask (matching web's "err toward show" behavior).
    let extraUsage: ExtraUsage | null | undefined
    try {
      const utilization = await fetchUtilization()
      extraUsage = utilization?.extra_usage
    } catch (error) {
      logError(error as Error)
    }

    if (extraUsage?.is_enabled && extraUsage.monthly_limit === null) {
      return {
        type: 'message',
        value:
          '您的组织已拥有无限额外使用量。无需请求。',
      }
    }

    try {
      const eligibility = await checkAdminRequestEligibility('limit_increase')
      if (eligibility?.is_allowed === false) {
        return {
          type: 'message',
          value: '请联系您的管理员以管理额外使用量设置。',
        }
      }
    } catch (error) {
      logError(error as Error)
      // If eligibility check fails, continue — the create endpoint will enforce if necessary
    }

    try {
      const pendingOrDismissedRequests = await getMyAdminRequests(
        'limit_increase',
        ['pending', 'dismissed'],
      )
      if (pendingOrDismissedRequests && pendingOrDismissedRequests.length > 0) {
        return {
          type: 'message',
          value:
            '您已经向管理员提交了额外使用量的请求。',
        }
      }
    } catch (error) {
      logError(error as Error)
      // Fall through to creating a new request below
    }

    try {
      await createAdminRequest({
        request_type: 'limit_increase',
        details: null,
      })
      return {
        type: 'message',
        value: extraUsage?.is_enabled
          ? '已向您的管理员发送请求以增加额外使用量。'
          : '已向您的管理员发送请求以启用额外使用量。',
      }
    } catch (error) {
      logError(error as Error)
      // Fall through to generic message below
    }

    return {
      type: 'message',
      value: '请联系您的管理员以管理额外使用量设置。',
    }
  }

  const url = isTeamOrEnterprise
    ? 'https://claude.ai/admin-settings/usage'
    : 'https://claude.ai/settings/usage'

  try {
    const opened = await openBrowser(url)
    return { type: 'browser-opened', url, opened }
  } catch (error) {
    logError(error as Error)
    return {
      type: 'message',
      value: `无法打开浏览器。请访问 ${url} 以管理额外使用量。`,
    }
  }
}
