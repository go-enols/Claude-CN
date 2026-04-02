type SnipLikeMessage = {
  type?: string
  subtype?: string
}

export const SNIP_NUDGE_TEXT =
  '在此重建的源快照中，上下文效率提示不可用。'

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export function shouldNudgeForSnips(_messages: readonly unknown[]): boolean {
  return false
}

export function isSnipMarkerMessage(message: unknown): boolean {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as SnipLikeMessage).subtype === 'snip_marker'
  )
}

export function snipCompactIfNeeded<T>(
  messages: T[],
  _options?: { force?: boolean },
): {
  messages: T[]
  tokensFreed: number
  boundaryMessage?: T
  executed: boolean
} {
  return {
    messages,
    tokensFreed: 0,
    executed: false,
  }
}
