import type { LocalCommandResult } from '../../types/command.js'
import { openBrowser } from '../../utils/browser.js'

export async function call(): Promise<LocalCommandResult> {
  const url = 'https://www.stickermule.com/claudecode'
  const success = await openBrowser(url)

  if (success) {
    return { type: 'text', value: '正在浏览器中打开贴纸页面…' }
  } else {
    return {
      type: 'text',
      value: `无法打开浏览器。请访问：${url}`,
    }
  }
}
