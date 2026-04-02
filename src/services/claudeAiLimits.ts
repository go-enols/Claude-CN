import { APIError } from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/index.mjs'
import isEqual from 'lodash-es/isEqual.js'
import { getIsNonInteractiveSession } from '../bootstrap/state.js'
import { isClaudeAISubscriber } from '../utils/auth.js'
import { getModelBetas } from '../utils/betas.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { logError } from '../utils/log.js'
import { getSmallFastModel } from '../utils/model/model.js'
import { isEssentialTrafficOnly } from '../utils/privacyLevel.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from './analytics/index.js'
import { logEvent } from './analytics/index.js'
import { getAPIMetadata } from './api/claude.js'
import { getAnthropicClient } from './api/client.js'
import {
  processRateLimitHeaders,
  shouldProcessRateLimits,
} from './rateLimitMocking.js'

// Re-export message functions from centralized location
export {
  getRateLimitErrorMessage,
  getRateLimitWarning,
  getUsingOverageText,
} from './rateLimitMessages.js'

type QuotaStatus = 'allowed' | 'allowed_warning' | 'rejected'

type RateLimitType =
  | 'five_hour'
  | 'seven_day'
  | 'seven_day_opus'
  | 'seven_day_sonnet'
  | 'overage'

export type { RateLimitType }

type EarlyWarningThreshold = {
  utilization: number // 0-1 比例：当使用率 >= 此值时触发警告
  timePct: number // 0-1 比例：当经过时间 <= 此值时触发警告
}

type EarlyWarningConfig = {
  rateLimitType: RateLimitType
  claimAbbrev: '5h' | '7d'
  windowSeconds: number
  thresholds: EarlyWarningThreshold[]
}

// 按优先级排序的早期警告配置（从后向前检查）
// 当服务器未发送 surpassed-threshold 头时用作后备
// 在用户消费配额快于时间窗口允许时警告用户
const EARLY_WARNING_CONFIGS: EarlyWarningConfig[] = [
  {
    rateLimitType: 'five_hour',
    claimAbbrev: '5h',
    windowSeconds: 5 * 60 * 60,
    thresholds: [{ utilization: 0.9, timePct: 0.72 }],
  },
  {
    rateLimitType: 'seven_day',
    claimAbbrev: '7d',
    windowSeconds: 7 * 24 * 60 * 60,
    thresholds: [
      { utilization: 0.75, timePct: 0.6 },
      { utilization: 0.5, timePct: 0.35 },
      { utilization: 0.25, timePct: 0.15 },
    ],
  },
]

// 将声明缩写映射到基于头检测的速率限制类型
const EARLY_WARNING_CLAIM_MAP: Record<string, RateLimitType> = {
  '5h': 'five_hour',
  '7d': 'seven_day',
  overage: 'overage',
}

const RATE_LIMIT_DISPLAY_NAMES: Record<RateLimitType, string> = {
  five_hour: '会话限制',
  seven_day: '每周限制',
  seven_day_opus: 'Opus 限制',
  seven_day_sonnet: 'Sonnet 限制',
  overage: '额外使用限制',
}

export function getRateLimitDisplayName(type: RateLimitType): string {
  return RATE_LIMIT_DISPLAY_NAMES[type] || type
}

/**
 * 计算时间窗口已过去的时间比例。
 * 用于时间相对早期警告后备。
 * @param resetsAt - 限制重置时的 Unix 纪元时间戳（秒）
 * @param windowSeconds - 窗口持续时间（秒）
 * @returns 窗口已过去的比例（0-1）
 */
function computeTimeProgress(resetsAt: number, windowSeconds: number): number {
  const nowSeconds = Date.now() / 1000
  const windowStart = resetsAt - windowSeconds
  const elapsed = nowSeconds - windowStart
  return Math.max(0, Math.min(1, elapsed / windowSeconds))
}

// 额外使用被禁用/拒绝的原因
// 这些值来自 API 的统一限制器
export type OverageDisabledReason =
  | 'overage_not_provisioned' // 此组织或座位层未配置额外使用
  | 'org_level_disabled' // 组织未启用额外使用
  | 'org_level_disabled_until' // 组织额外使用暂时禁用
  | 'out_of_credits' // 组织信用额度不足
  | 'seat_tier_level_disabled' // 座位层未启用额外使用
  | 'member_level_disabled' // 账户明确禁用额外使用
  | 'seat_tier_zero_credit_limit' // 座位层信用额度为零
  | 'group_zero_credit_limit' // 解析后的组限制信用额度为零
  | 'member_zero_credit_limit' // 账户信用额度为零
  | 'org_service_level_disabled' // 组织服务明确禁用额外使用
  | 'org_service_zero_credit_limit' // 组织服务信用额度为零
  | 'no_limits_configured' // 账户未配置额外使用限制
  | 'unknown' // 未知原因，不应发生

export type ClaudeAILimits = {
  status: QuotaStatus
  // unifiedRateLimitFallbackAvailable 当前用于警告将模型设置为 Opus 的用户
  // 当他们即将用完配额时。它不会改变实际使用的模型。
  unifiedRateLimitFallbackAvailable: boolean
  resetsAt?: number
  rateLimitType?: RateLimitType
  utilization?: number
  overageStatus?: QuotaStatus
  overageResetsAt?: number
  overageDisabledReason?: OverageDisabledReason
  isUsingOverage?: boolean
  surpassedThreshold?: number
}

// 仅用于测试导出
export let currentLimits: ClaudeAILimits = {
  status: 'allowed',
  unifiedRateLimitFallbackAvailable: false,
  isUsingOverage: false,
}

/**
 * 来自响应头的原始每窗口使用率，在每个 API
 * 响应上跟踪（与 currentLimits.utilization 不同，后者仅在警告
 * 阈值触发时设置）。通过 getRawUtilization() 向 statusline 脚本公开。
 */
type RawWindowUtilization = {
  utilization: number // 0-1 比例
  resets_at: number // Unix 纪元秒
}
type RawUtilization = {
  five_hour?: RawWindowUtilization
  seven_day?: RawWindowUtilization
}
let rawUtilization: RawUtilization = {}

export function getRawUtilization(): RawUtilization {
  return rawUtilization
}

function extractRawUtilization(headers: globalThis.Headers): RawUtilization {
  const result: RawUtilization = {}
  for (const [key, abbrev] of [
    ['five_hour', '5h'],
    ['seven_day', '7d'],
  ] as const) {
    const util = headers.get(
      `anthropic-ratelimit-unified-${abbrev}-utilization`,
    )
    const reset = headers.get(`anthropic-ratelimit-unified-${abbrev}-reset`)
    if (util !== null && reset !== null) {
      result[key] = { utilization: Number(util), resets_at: Number(reset) }
    }
  }
  return result
}

type StatusChangeListener = (limits: ClaudeAILimits) => void
export const statusListeners: Set<StatusChangeListener> = new Set()

export function emitStatusChange(limits: ClaudeAILimits) {
  currentLimits = limits
  statusListeners.forEach(listener => listener(limits))
  const hoursTillReset = Math.round(
    (limits.resetsAt ? limits.resetsAt - Date.now() / 1000 : 0) / (60 * 60),
  )

  logEvent('tengu_claudeai_limits_status_changed', {
    status:
      limits.status as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    unifiedRateLimitFallbackAvailable: limits.unifiedRateLimitFallbackAvailable,
    hoursTillReset,
  })
}

async function makeTestQuery() {
  const model = getSmallFastModel()
  const anthropic = await getAnthropicClient({
    maxRetries: 0,
    model,
    source: 'quota_check',
  })
  const messages: MessageParam[] = [{ role: 'user', content: 'quota' }]
  const betas = getModelBetas(model)
  // biome-ignore lint/plugin: quota check needs raw response access via asResponse()
  return anthropic.beta.messages
    .create({
      model,
      max_tokens: 1,
      messages,
      metadata: getAPIMetadata(),
      ...(betas.length > 0 ? { betas } : {}),
    })
    .asResponse()
}

export async function checkQuotaStatus(): Promise<void> {
  // Skip network requests if nonessential traffic is disabled
  if (isEssentialTrafficOnly()) {
    return
  }

  // Check if we should process rate limits (real subscriber or mock testing)
  if (!shouldProcessRateLimits(isClaudeAISubscriber())) {
    return
  }

  // In non-interactive mode (-p), the real query follows immediately and
  // extractQuotaStatusFromHeaders() will update limits from its response
  // headers (claude.ts), so skip this pre-check API call.
  if (getIsNonInteractiveSession()) {
    return
  }

  try {
    // Make a minimal request to check quota
    const raw = await makeTestQuery()

    // Update limits based on the response
    extractQuotaStatusFromHeaders(raw.headers)
  } catch (error) {
    if (error instanceof APIError) {
      extractQuotaStatusFromError(error)
    }
  }
}

/**
 * 检查是否应基于 surpassed-threshold 头触发早期警告。
 * 如果阈值被超越则返回 ClaudeAILimits，否则返回 null。
 */
function getHeaderBasedEarlyWarning(
  headers: globalThis.Headers,
  unifiedRateLimitFallbackAvailable: boolean,
): ClaudeAILimits | null {
  // Check each claim type for surpassed threshold header
  for (const [claimAbbrev, rateLimitType] of Object.entries(
    EARLY_WARNING_CLAIM_MAP,
  )) {
    const surpassedThreshold = headers.get(
      `anthropic-ratelimit-unified-${claimAbbrev}-surpassed-threshold`,
    )

    // If threshold header is present, user has crossed a warning threshold
    if (surpassedThreshold !== null) {
      const utilizationHeader = headers.get(
        `anthropic-ratelimit-unified-${claimAbbrev}-utilization`,
      )
      const resetHeader = headers.get(
        `anthropic-ratelimit-unified-${claimAbbrev}-reset`,
      )

      const utilization = utilizationHeader
        ? Number(utilizationHeader)
        : undefined
      const resetsAt = resetHeader ? Number(resetHeader) : undefined

      return {
        status: 'allowed_warning',
        resetsAt,
        rateLimitType: rateLimitType as RateLimitType,
        utilization,
        unifiedRateLimitFallbackAvailable,
        isUsingOverage: false,
        surpassedThreshold: Number(surpassedThreshold),
      }
    }
  }

  return null
}

/**
 * 检查是否应为速率限制类型触发时间相对早期警告。
 * 当服务器未发送 surpassed-threshold 头时的后备。
 * 如果超过阈值则返回 ClaudeAILimits，否则返回 null。
 */
function getTimeRelativeEarlyWarning(
  headers: globalThis.Headers,
  config: EarlyWarningConfig,
  unifiedRateLimitFallbackAvailable: boolean,
): ClaudeAILimits | null {
  const { rateLimitType, claimAbbrev, windowSeconds, thresholds } = config

  const utilizationHeader = headers.get(
    `anthropic-ratelimit-unified-${claimAbbrev}-utilization`,
  )
  const resetHeader = headers.get(
    `anthropic-ratelimit-unified-${claimAbbrev}-reset`,
  )

  if (utilizationHeader === null || resetHeader === null) {
    return null
  }

  const utilization = Number(utilizationHeader)
  const resetsAt = Number(resetHeader)
  const timeProgress = computeTimeProgress(resetsAt, windowSeconds)

  // Check if any threshold is exceeded: high usage early in the window
  const shouldWarn = thresholds.some(
    t => utilization >= t.utilization && timeProgress <= t.timePct,
  )

  if (!shouldWarn) {
    return null
  }

  return {
    status: 'allowed_warning',
    resetsAt,
    rateLimitType,
    utilization,
    unifiedRateLimitFallbackAvailable,
    isUsingOverage: false,
  }
}

/**
 * 使用基于头检测和时间相对后备获取早期警告限制。
 * 1. 首先检查 surpassed-threshold 头（新的服务器端方法）
 * 2. 后备到时间相对阈值（客户端计算）
 */
function getEarlyWarningFromHeaders(
  headers: globalThis.Headers,
  unifiedRateLimitFallbackAvailable: boolean,
): ClaudeAILimits | null {
  // Try header-based detection first (preferred when API sends the header)
  const headerBasedWarning = getHeaderBasedEarlyWarning(
    headers,
    unifiedRateLimitFallbackAvailable,
  )
  if (headerBasedWarning) {
    return headerBasedWarning
  }

  // Fallback: Use time-relative thresholds (client-side calculation)
  // This catches users burning quota faster than sustainable
  for (const config of EARLY_WARNING_CONFIGS) {
    const timeRelativeWarning = getTimeRelativeEarlyWarning(
      headers,
      config,
      unifiedRateLimitFallbackAvailable,
    )
    if (timeRelativeWarning) {
      return timeRelativeWarning
    }
  }

  return null
}

function computeNewLimitsFromHeaders(
  headers: globalThis.Headers,
): ClaudeAILimits {
  const status =
    (headers.get('anthropic-ratelimit-unified-status') as QuotaStatus) ||
    'allowed'
  const resetsAtHeader = headers.get('anthropic-ratelimit-unified-reset')
  const resetsAt = resetsAtHeader ? Number(resetsAtHeader) : undefined
  const unifiedRateLimitFallbackAvailable =
    headers.get('anthropic-ratelimit-unified-fallback') === 'available'

  // Headers for rate limit type and overage support
  const rateLimitType = headers.get(
    'anthropic-ratelimit-unified-representative-claim',
  ) as RateLimitType | null
  const overageStatus = headers.get(
    'anthropic-ratelimit-unified-overage-status',
  ) as QuotaStatus | null
  const overageResetsAtHeader = headers.get(
    'anthropic-ratelimit-unified-overage-reset',
  )
  const overageResetsAt = overageResetsAtHeader
    ? Number(overageResetsAtHeader)
    : undefined

  // Reason why overage is disabled (spending cap or wallet empty)
  const overageDisabledReason = headers.get(
    'anthropic-ratelimit-unified-overage-disabled-reason',
  ) as OverageDisabledReason | null

  // Determine if we're using overage (standard limits rejected but overage allowed)
  const isUsingOverage =
    status === 'rejected' &&
    (overageStatus === 'allowed' || overageStatus === 'allowed_warning')

  // Check for early warning based on surpassed-threshold header
  // If status is allowed/allowed_warning and we find a surpassed threshold, show warning
  let finalStatus: QuotaStatus = status
  if (status === 'allowed' || status === 'allowed_warning') {
    const earlyWarning = getEarlyWarningFromHeaders(
      headers,
      unifiedRateLimitFallbackAvailable,
    )
    if (earlyWarning) {
      return earlyWarning
    }
    // No early warning threshold surpassed
    finalStatus = 'allowed'
  }

  return {
    status: finalStatus,
    resetsAt,
    unifiedRateLimitFallbackAvailable,
    ...(rateLimitType && { rateLimitType }),
    ...(overageStatus && { overageStatus }),
    ...(overageResetsAt && { overageResetsAt }),
    ...(overageDisabledReason && { overageDisabledReason }),
    isUsingOverage,
  }
}

/**
 * 缓存 API 头中的额外使用禁用原因。
 */
function cacheExtraUsageDisabledReason(headers: globalThis.Headers): void {
  // A null reason means extra usage is enabled (no disabled reason header)
  const reason =
    headers.get('anthropic-ratelimit-unified-overage-disabled-reason') ?? null
  const cached = getGlobalConfig().cachedExtraUsageDisabledReason
  if (cached !== reason) {
    saveGlobalConfig(current => ({
      ...current,
      cachedExtraUsageDisabledReason: reason,
    }))
  }
}

export function extractQuotaStatusFromHeaders(
  headers: globalThis.Headers,
): void {
  // 检查是否需要处理速率限制
  const isSubscriber = isClaudeAISubscriber()

  if (!shouldProcessRateLimits(isSubscriber)) {
    // 如果有任何速率限制状态，清除它
    rawUtilization = {}
    if (currentLimits.status !== 'allowed' || currentLimits.resetsAt) {
      const defaultLimits: ClaudeAILimits = {
        status: 'allowed',
        unifiedRateLimitFallbackAvailable: false,
        isUsingOverage: false,
      }
      emitStatusChange(defaultLimits)
    }
    return
  }

  // 处理头（如果 /mock-limits 命令处于活动状态则应用模拟）
  const headersToUse = processRateLimitHeaders(headers)
  rawUtilization = extractRawUtilization(headersToUse)
  const newLimits = computeNewLimitsFromHeaders(headersToUse)

  // 缓存额外使用状态（跨会话持久化）
  cacheExtraUsageDisabledReason(headersToUse)

  if (!isEqual(currentLimits, newLimits)) {
    emitStatusChange(newLimits)
  }
}

export function extractQuotaStatusFromError(error: APIError): void {
  if (
    !shouldProcessRateLimits(isClaudeAISubscriber()) ||
    error.status !== 429
  ) {
    return
  }

  try {
    let newLimits = { ...currentLimits }
    if (error.headers) {
      // 处理头（如果 /mock-limits 命令处于活动状态则应用模拟）
      const headersToUse = processRateLimitHeaders(error.headers)
      rawUtilization = extractRawUtilization(headersToUse)
      newLimits = computeNewLimitsFromHeaders(headersToUse)

      // 缓存额外使用状态（跨会话持久化）
      cacheExtraUsageDisabledReason(headersToUse)
    }
    // 对于错误，即使头不存在，也始终将状态设置为 rejected。
    newLimits.status = 'rejected'

    if (!isEqual(currentLimits, newLimits)) {
      emitStatusChange(newLimits)
    }
  } catch (e) {
    logError(e as Error)
  }
}
