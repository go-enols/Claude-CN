import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import {
  getAllowedChannels,
  handlePlanModeTransition,
} from '../../bootstrap/state.js'
import type { Tool } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { applyPermissionUpdate } from '../../utils/permissions/PermissionUpdate.js'
import { prepareContextForPlanMode } from '../../utils/permissions/permissionSetup.js'
import { isPlanModeInterviewPhaseEnabled } from '../../utils/planModeV2.js'
import { ENTER_PLAN_MODE_TOOL_NAME } from './constants.js'
import { getEnterPlanModeToolPrompt } from './prompt.js'
import {
  renderToolResultMessage,
  renderToolUseMessage,
  renderToolUseRejectedMessage,
} from './UI.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    // No parameters needed
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    message: z.string().describe('Confirmation that plan mode was entered'),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

export const EnterPlanModeTool: Tool<InputSchema, Output> = buildTool({
  name: ENTER_PLAN_MODE_TOOL_NAME,
  searchHint: '切换到计划模式以在编码前设计方法',
  maxResultSizeChars: 100_000,
  async description() {
    return '请求进入计划模式以处理需要探索和设计的复杂任务'
  },
  async prompt() {
    return getEnterPlanModeToolPrompt()
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return ''
  },
  shouldDefer: true,
  isEnabled() {
    // When --channels is active, ExitPlanMode is disabled (its approval
    // dialog needs the terminal). Disable entry too so plan mode isn't a
    // trap the model can enter but never leave.
    if (
      (feature('KAIROS') || feature('KAIROS_CHANNELS')) &&
      getAllowedChannels().length > 0
    ) {
      return false
    }
    return true
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  renderToolUseMessage,
  renderToolResultMessage,
  renderToolUseRejectedMessage,
  async call(_input, context) {
    if (context.agentId) {
      throw new Error('EnterPlanMode 工具不能在代理上下文中使用')
    }

    const appState = context.getAppState()
    handlePlanModeTransition(appState.toolPermissionContext.mode, 'plan')

    // Update the permission mode to 'plan'. prepareContextForPlanMode runs
    // the classifier activation side effects when the user's defaultMode is
    // 'auto' — see permissionSetup.ts for the full lifecycle.
    context.setAppState(prev => ({
      ...prev,
      toolPermissionContext: applyPermissionUpdate(
        prepareContextForPlanMode(prev.toolPermissionContext),
        { type: 'setMode', mode: 'plan', destination: 'session' },
      ),
    }))

    return {
      data: {
        message:
          '已进入计划模式。您现在应该专注于探索代码库并设计实现方法。',
      },
    }
  },
  mapToolResultToToolResultBlockParam({ message }, toolUseID) {
    const instructions = isPlanModeInterviewPhaseEnabled()
      ? `${message}

请勿编写或编辑任何文件，除了计划文件。详细的工作流程说明将随之而来。`
      : `${message}

在计划模式下，您应该：
1. 彻底探索代码库以了解现有模式
2. 识别类似的功能和架构方法
3. 考虑多种方法及其权衡
4. 如果需要澄清方法，请使用 AskUserQuestion
5. 设计具体的实施策略
6. 准备就绪后，使用 ExitPlanMode 提交您的计划以获得批准

请记住：请勿编写或编辑任何文件。这是一个只读的探索和规划阶段。`

    return {
      type: 'tool_result',
      content: instructions,
      tool_use_id: toolUseID,
    }
  },
} satisfies ToolDef<InputSchema, Output>)
