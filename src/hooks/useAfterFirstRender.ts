import { useEffect } from 'react'
import { isEnvTruthy } from '../utils/envUtils.js'

export function useAfterFirstRender(): void {
  useEffect(() => {
    if (
      process.env.USER_TYPE === 'ant' &&
      isEnvTruthy(process.env.CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER)
    ) {
      process.stderr.write(
        `\n启动时间：${Math.round(process.uptime() * 1000)}毫秒\n`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(0)
    }
  }, [])
}
