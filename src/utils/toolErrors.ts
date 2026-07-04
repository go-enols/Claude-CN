import type { ZodError } from 'zod/v4'
import { AbortError, ShellError } from './errors.js'
import { INTERRUPT_MESSAGE_FOR_TOOL_USE } from './messages.js'

export function formatError(error: unknown): string {
  if (error instanceof AbortError) {
    return error.message || INTERRUPT_MESSAGE_FOR_TOOL_USE
  }
  if (!(error instanceof Error)) {
    return String(error)
  }
  const parts = getErrorParts(error)
  const fullMessage =
    parts.filter(Boolean).join('\n').trim() || '命令执行失败，没有输出'
  if (fullMessage.length <= 10000) {
    return fullMessage
  }
  const halfLength = 5000
  const start = fullMessage.slice(0, halfLength)
  const end = fullMessage.slice(-halfLength)
  return `${start}\n\n... [${fullMessage.length - 10000} 字符已截断] ...\n\n${end}`
}

export function getErrorParts(error: Error): string[] {
  if (error instanceof ShellError) {
    return [
      `退出码 ${error.code}`,
      error.interrupted ? INTERRUPT_MESSAGE_FOR_TOOL_USE : '',
      error.stderr,
      error.stdout,
    ]
  }
  const parts = [error.message]
  if ('stderr' in error && typeof error.stderr === 'string') {
    parts.push(error.stderr)
  }
  if ('stdout' in error && typeof error.stdout === 'string') {
    parts.push(error.stdout)
  }
  return parts
}

/**
 * 将 Zod 验证路径格式化为可读字符串
 * 例如: ['todos', 0, 'activeForm'] => 'todos[0].activeForm'
 */
function formatValidationPath(path: PropertyKey[]): string {
  if (path.length === 0) return ''

  return path.reduce((acc, segment, index) => {
    const segmentStr = String(segment)
    if (typeof segment === 'number') {
      return `${String(acc)}[${segmentStr}]`
    }
    return index === 0 ? segmentStr : `${String(acc)}.${segmentStr}`
  }, '') as string
}

/**
 * 将 Zod 验证错误转换为人类可读且对 LLM 友好的错误消息
 *
 * @param toolName 验证失败的工具名称
 * @param error Zod 错误对象
 * @returns 格式化的错误消息字符串
 */
export function formatZodValidationError(
  toolName: string,
  error: ZodError,
): string {
  const missingParams = error.issues
    .filter(
      err =>
        err.code === 'invalid_type' &&
        err.message.includes('received undefined'),
    )
    .map(err => formatValidationPath(err.path))

  const unexpectedParams = error.issues
    .filter(err => err.code === 'unrecognized_keys')
    .flatMap(err => err.keys)

  const typeMismatchParams = error.issues
    .filter(
      err =>
        err.code === 'invalid_type' &&
        !err.message.includes('received undefined'),
    )
    .map(err => {
      const typeErr = err as { expected: string }
      const receivedMatch = err.message.match(/received (\w+)/)
      const received = receivedMatch ? receivedMatch[1] : 'unknown'
      return {
        param: formatValidationPath(err.path),
        expected: typeErr.expected,
        received,
      }
    })

  // 如果无法创建更好的消息，则使用原始错误消息
  let errorContent = error.message

  // 构建人类可读的错误消息
  const errorParts = []

  if (missingParams.length > 0) {
    const missingParamErrors = missingParams.map(
      param => `必需参数 \`${param}\` 缺失`,
    )
    errorParts.push(...missingParamErrors)
  }

  if (unexpectedParams.length > 0) {
    const unexpectedParamErrors = unexpectedParams.map(
      param => `提供了意外参数 \`${param}\``,
    )
    errorParts.push(...unexpectedParamErrors)
  }

  if (typeMismatchParams.length > 0) {
    const typeErrors = typeMismatchParams.map(
      ({ param, expected, received }) =>
        `参数 \`${param}\` 的类型应为 \`${expected}\`，但实际提供的是 \`${received}\``,
    )
    errorParts.push(...typeErrors)
  }

  if (errorParts.length > 0) {
    errorContent = `${toolName} 因以下 ${errorParts.length > 1 ? '问题' : '问题'}失败:\n${errorParts.join('\n')}`
  }

  return errorContent
}
