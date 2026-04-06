import React, { useCallback } from 'react'
import { Box, Text } from '../ink.js'
import { Select } from './CustomSelect/index.js'
import { Dialog } from './design-system/Dialog.js'
import type { AppState } from '../state/AppStateStore.js'
import { useSetAppState } from '../state/AppState.js'
import type { Message } from '../types/message.js'
import type { RemoteAgentTaskState } from '../tasks/RemoteAgentTask/RemoteAgentTask.js'
import type { FileStateCache } from '../utils/fileStateCache.js'
import {
  createUserMessage,
  createSystemMessage,
  prepareUserContent,
} from '../utils/messages.js'
import { updateTaskState } from '../utils/task/framework.js'
import { archiveRemoteSession } from '../utils/teleport.js'
import { logForDebugging } from '../utils/debug.js'

type UltraplanChoice = 'execute' | 'dismiss'

type Props = {
  plan: string
  sessionId: string
  taskId: string
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  readFileState: FileStateCache
  getAppState: () => AppState
  setConversationId: (id: string) => void
}

export function UltraplanChoiceDialog({
  plan,
  sessionId,
  taskId,
  setMessages,
}: Props): React.ReactNode {
  const setAppState = useSetAppState()

  const handleChoice = useCallback(
    (choice: UltraplanChoice) => {
      if (choice === 'execute') {
        setMessages(prev => [
          ...prev,
          createSystemMessage(
            'Ultraplan 已批准。正在执行以下计划：',
            'info',
          ),
          createUserMessage({
            content: prepareUserContent({ inputString: plan }),
          }),
        ])
      }

      // Mark task completed
      updateTaskState<RemoteAgentTaskState>(taskId, setAppState, t =>
        t.status !== 'running'
          ? t
          : { ...t, status: 'completed', endTime: Date.now() },
      )

      // Clear ultraplan state
      setAppState(prev => ({
        ...prev,
        ultraplanPendingChoice: undefined,
        ultraplanSessionUrl: undefined,
      }))

      // Archive the remote session
      void archiveRemoteSession(sessionId).catch(e =>
        logForDebugging(`ultraplan choice archive failed: ${String(e)}`),
      )
    },
    [plan, sessionId, taskId, setMessages, setAppState],
  )

  const displayPlan =
    plan.length > 2000 ? plan.slice(0, 2000) + '\n\n...（已截断）' : plan

  return (
    <Dialog
      title="Ultraplan 就绪"
      onCancel={() => handleChoice('dismiss')}
    >
      <Box flexDirection="column" gap={1}>
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          height={Math.min(displayPlan.split('\n').length + 2, 20)}
          overflow="hidden"
        >
          <Text>{displayPlan}</Text>
        </Box>
      </Box>
      <Select
        options={[
          {
            value: 'execute' as const,
            label: '在此执行计划',
            description:
              '将计划发送到 Claude 在此会话中执行',
          },
          {
            value: 'dismiss' as const,
            label: '忽略',
            description: '放弃该计划',
          },
        ]}
        onChange={(value: UltraplanChoice) => handleChoice(value)}
      />
    </Dialog>
  )
}
