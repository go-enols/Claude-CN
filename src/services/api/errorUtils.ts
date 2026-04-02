import type { APIError } from '@anthropic-ai/sdk'

// SSL/TLS error codes from OpenSSL (used by both Node.js and Bun)
// See: https://www.openssl.org/docs/man3.1/man3/X509_STORE_CTX_get_error.html
const SSL_ERROR_CODES = new Set([
  // Certificate verification errors
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'CERT_SIGNATURE_FAILURE',
  'CERT_NOT_YET_VALID',
  'CERT_HAS_EXPIRED',
  'CERT_REVOKED',
  'CERT_REJECTED',
  'CERT_UNTRUSTED',
  // Self-signed certificate errors
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  // Chain errors
  'CERT_CHAIN_TOO_LONG',
  'PATH_LENGTH_EXCEEDED',
  // Hostname/altname errors
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'HOSTNAME_MISMATCH',
  // TLS handshake errors
  'ERR_TLS_HANDSHAKE_TIMEOUT',
  'ERR_SSL_WRONG_VERSION_NUMBER',
  'ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC',
])

export type ConnectionErrorDetails = {
  code: string
  message: string
  isSSLError: boolean
}

/**
 * Extracts connection error details from the error cause chain.
 * The Anthropic SDK wraps underlying errors in the `cause` property.
 * This function walks the cause chain to find the root error code/message.
 */
export function extractConnectionErrorDetails(
  error: unknown,
): ConnectionErrorDetails | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  // Walk the cause chain to find the root error with a code
  let current: unknown = error
  const maxDepth = 5 // Prevent infinite loops
  let depth = 0

  while (current && depth < maxDepth) {
    if (
      current instanceof Error &&
      'code' in current &&
      typeof current.code === 'string'
    ) {
      const code = current.code
      const isSSLError = SSL_ERROR_CODES.has(code)
      return {
        code,
        message: current.message,
        isSSLError,
      }
    }

    // Move to the next cause in the chain
    if (
      current instanceof Error &&
      'cause' in current &&
      current.cause !== current
    ) {
      current = current.cause
      depth++
    } else {
      break
    }
  }

  return null
}

/**
 * Returns an actionable hint for SSL/TLS errors, intended for contexts outside
 * the main API client (OAuth token exchange, preflight connectivity checks)
 * where `formatAPIError` doesn't apply.
 *
 * Motivation: enterprise users behind TLS-intercepting proxies (Zscaler et al.)
 * see OAuth complete in-browser but the CLI's token exchange silently fails
 * with a raw SSL code. Surfacing the likely fix saves a support round-trip.
 */
export function getSSLErrorHint(error: unknown): string | null {
  const details = extractConnectionErrorDetails(error)
  if (!details?.isSSLError) {
    return null
  }
  return `SSL 证书错误（${details.code}）。如果您在企业代理或 TLS 拦截防火墙后面，请将 NODE_EXTRA_CA_CERTS 设置为您的 CA 证书路径，或请 IT 允许 *.anthropic.com。运行 /doctor 了解详情。`
}

/**
 * Strips HTML content (e.g., CloudFlare error pages) from a message string,
 * returning a user-friendly title or empty string if HTML is detected.
 * Returns the original message unchanged if no HTML is found.
 */
function sanitizeMessageHTML(message: string): string {
  if (message.includes('<!DOCTYPE html') || message.includes('<html')) {
    const titleMatch = message.match(/<title>([^<]+)<\/title>/)
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim()
    }
    return ''
  }
  return message
}

/**
 * Detects if an error message contains HTML content (e.g., CloudFlare error pages)
 * and returns a user-friendly message instead
 */
export function sanitizeAPIError(apiError: APIError): string {
  const message = apiError.message
  if (!message) {
    // Sometimes message is undefined
    // TODO: figure out why
    return ''
  }
  return sanitizeMessageHTML(message)
}

/**
 * Shapes of deserialized API errors from session JSONL.
 *
 * After JSON round-tripping, the SDK's APIError loses its `.message` property.
 * The actual message lives at different nesting levels depending on the provider:
 *
 * - Bedrock/proxy: `{ error: { message: "..." } }`
 * - Standard Anthropic API: `{ error: { error: { message: "..." } } }`
 *   (the outer `.error` is the response body, the inner `.error` is the API error)
 *
 * See also: `getErrorMessage` in `logging.ts` which handles the same shapes.
 */
type NestedAPIError = {
  error?: {
    message?: string
    error?: { message?: string }
  }
}

function hasNestedError(value: unknown): value is NestedAPIError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null
  )
}

/**
 * Extract a human-readable message from a deserialized API error that lacks
 * a top-level `.message`.
 *
 * Checks two nesting levels (deeper first for specificity):
 * 1. `error.error.error.message` — standard Anthropic API shape
 * 2. `error.error.message` — Bedrock shape
 */
function extractNestedErrorMessage(error: APIError): string | null {
  if (!hasNestedError(error)) {
    return null
  }

  // Access `.error` via the narrowed type so TypeScript sees the nested shape
  // instead of the SDK's `Object | undefined`.
  const narrowed: NestedAPIError = error
  const nested = narrowed.error

  // Standard Anthropic API shape: { error: { error: { message } } }
  const deepMsg = nested?.error?.message
  if (typeof deepMsg === 'string' && deepMsg.length > 0) {
    const sanitized = sanitizeMessageHTML(deepMsg)
    if (sanitized.length > 0) {
      return sanitized
    }
  }

  // Bedrock shape: { error: { message } }
  const msg = nested?.message
  if (typeof msg === 'string' && msg.length > 0) {
    const sanitized = sanitizeMessageHTML(msg)
    if (sanitized.length > 0) {
      return sanitized
    }
  }

  return null
}

export function formatAPIError(error: APIError): string {
  // Extract connection error details from the cause chain
  const connectionDetails = extractConnectionErrorDetails(error)

  if (connectionDetails) {
    const { code, isSSLError } = connectionDetails

    // Handle timeout errors
    if (code === 'ETIMEDOUT') {
      return '请求超时。请检查您的网络连接和代理设置'
    }

    // Handle SSL/TLS errors with specific messages
    if (isSSLError) {
      switch (code) {
        case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
        case 'UNABLE_TO_GET_ISSUER_CERT':
        case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
          return '无法连接到 API：SSL 证书验证失败。请检查您的代理或企业 SSL 证书'
        case 'CERT_HAS_EXPIRED':
          return '无法连接到 API：SSL 证书已过期'
        case 'CERT_REVOKED':
          return '无法连接到 API：SSL 证书已被吊销'
        case 'DEPTH_ZERO_SELF_SIGNED_CERT':
        case 'SELF_SIGNED_CERT_IN_CHAIN':
          return '无法连接到 API：检测到自签名证书。请检查您的代理或企业 SSL 证书'
        case 'ERR_TLS_CERT_ALTNAME_INVALID':
        case 'HOSTNAME_MISMATCH':
          return '无法连接到 API：SSL 证书主机名不匹配'
        case 'CERT_NOT_YET_VALID':
          return '无法连接到 API：SSL 证书尚未生效'
        default:
          return `无法连接到 API：SSL 错误（${code}）`
      }
    }
  }

  if (error.message === 'Connection error.') {
    // If we have a code but it's not SSL, include it for debugging
    if (connectionDetails?.code) {
      return `无法连接到 API（${connectionDetails.code}）`
    }
    return '无法连接到 API。请检查您的网络连接'
  }

  // Guard: when deserialized from JSONL (e.g. --resume), the error object may
  // be a plain object without a `.message` property.  Return a safe fallback
  // instead of undefined, which would crash callers that access `.length`.
  if (!error.message) {
    return (
      extractNestedErrorMessage(error) ??
      `API error (status ${error.status ?? 'unknown'})`
    )
  }

  const sanitizedMessage = sanitizeAPIError(error)
  // Use sanitized message if it's different from the original (i.e., HTML was sanitized)
  return sanitizedMessage !== error.message && sanitizedMessage.length > 0
    ? sanitizedMessage
    : error.message
}
