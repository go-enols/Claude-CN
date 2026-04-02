import { runExtraUsage } from './extra-usage-core.js'

export async function call(): Promise<{ type: 'text'; value: string }> {
  const result = await runExtraUsage()

  if (result.type === 'message') {
    return { type: 'text', value: result.value }
  }

  return {
    type: 'text',
    value: result.opened
      ? `浏览器已打开以管理额外使用量。如果未打开，请访问：${result.url}`
      : `请访问 ${result.url} 以管理额外使用量。`,
  }
}
