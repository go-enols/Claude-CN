import { useContext } from 'react'
import {
  type TerminalSize,
  TerminalSizeContext,
} from 'src/ink/components/TerminalSizeContext.js'

export function useTerminalSize(): TerminalSize {
  const size = useContext(TerminalSizeContext)

  if (!size) {
    throw new Error('useTerminalSize 必须在 Ink App 组件内使用')
  }

  return size
}
