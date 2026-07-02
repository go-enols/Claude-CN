import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled.js'
export const DESCRIPTION = '列出任务列表中的所有任务'
export function getPrompt(): string {
  const teammateUseCase = isAgentSwarmsEnabled()
    ? `- 在向团队成员分配任务前，查看有哪些可用任务
`
    : ''
  const idDescription = isAgentSwarmsEnabled()
    ? '- **id**：任务标识符（与 TaskGet、TaskUpdate 配合使用）'
    : '- **id**：任务标识符（与 TaskGet、TaskUpdate 配合使用）'
  const teammateWorkflow = isAgentSwarmsEnabled()
    ? `
## 团队成员工作流
作为团队成员时：
1. 完成当前任务后，调用 TaskList 查找可用的工作
2. 查找状态为 'pending'（待处理）、无负责人、且 blockedBy 为空的任务
3. **优先按 ID 顺序处理任务**（当有多个任务可用时，优先选择 ID 最低的任务），因为较早的任务通常为后续任务设置上下文
4. 使用 TaskUpdate 认领可用任务（将 \`owner\` 设置为你的名称），或等待负责人分配
5. 如果被阻塞，专注于解除阻塞任务或通知团队负责人
`
    : ''
  return `使用此工具列出任务列表中的所有任务。
## 何时使用此工具
- 查看有哪些任务可以处理（状态：'pending'（待处理）、无负责人、未被阻塞）
- 检查项目的整体进度
- 查找被阻塞且需要解决依赖关系的任务
${teammateUseCase}- 完成任务后，检查是否有新解除阻塞的工作或认领下一个可用任务
- **优先按 ID 顺序处理任务**（当有多个任务可用时，优先选择 ID 最低的任务），因为较早的任务通常为后续任务设置上下文
## 输出
返回每个任务的摘要：
${idDescription}
- **subject**：任务简要描述
- **status**：'pending'（待处理）、'in_progress'（进行中）或 'completed'（已完成）
- **owner**：如果已分配，则为 Agent ID；如果可用，则为空
- **blockedBy**：必须先解决的未完成任务 ID 列表（有 blockedBy 的任务在依赖关系解决前无法认领）
使用 TaskGet 并指定具体任务 ID 查看完整详情（包括描述和评论）。
${teammateWorkflow}`
}
