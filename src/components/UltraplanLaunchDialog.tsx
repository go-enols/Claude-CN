import React from 'react'
import { Box, Text } from '../ink.js'
import { Select } from './CustomSelect/index.js'
import { Dialog } from './design-system/Dialog.js'
import { CCR_TERMS_URL } from '../commands/ultraplan.js'

type UltraplanLaunchChoice = 'launch' | 'cancel'

type Props = {
  onChoice: (
    choice: UltraplanLaunchChoice,
    opts?: { disconnectedBridge?: boolean },
  ) => void
}

export function UltraplanLaunchDialog({ onChoice }: Props): React.ReactNode {
  return (
    <Dialog
      title="启动 ultraplan？"
      onCancel={() => onChoice('cancel')}
    >
      <Box flexDirection="column" gap={1}>
        <Text>
          这将在网页上启动一个远程 Claude Code 会话，使用 Opus 起草一个高级计划。该计划通常需要 10–30 分钟。工作时您的终端保持空闲。
        </Text>
        <Text dimColor>条款：{CCR_TERMS_URL}</Text>
      </Box>
      <Select
        options={[
          {
            value: 'launch' as const,
            label: '启动 ultraplan',
          },
          {
            value: 'cancel' as const,
            label: '取消',
          },
        ]}
        onChange={(value: UltraplanLaunchChoice) => onChoice(value)}
      />
    </Dialog>
  )
}
