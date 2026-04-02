import { getSessionMemoryContent } from '../../services/SessionMemory/sessionMemoryUtils.js'
import type { Message } from '../../types/message.js'
import { getMessagesAfterCompactBoundary } from '../../utils/messages.js'
import { registerBundledSkill } from '../bundledSkills.js'

function extractUserMessages(messages: Message[]): string[] {
  return messages
    .filter((m): m is Extract<typeof m, { type: 'user' }> => m.type === 'user')
    .map(m => {
      const content = m.message.content
      if (typeof content === 'string') return content
      return content
        .filter(
          (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
        )
        .map(b => b.text)
        .join('\n')
    })
    .filter(text => text.trim().length > 0)
}

const SKILLIFY_PROMPT = `# Skillify {{userDescriptionBlock}}

您正在将此会话的可重复过程捕获为可重用的技能。

## 您的会话上下文

以下是会话记忆摘要：
<session_memory>
{{sessionMemory}}
</session_memory>

以下是此会话期间用户的消息。注意他们如何引导过程，以帮助在技能中捕获他们的详细偏好：
<user_messages>
{{userMessages}}
</user_messages>

## 您的任务

### 步骤 1：分析会话

在询问任何问题之前，分析会话以识别：
- 执行了什么可重复过程
- 输入/参数是什么
- 步骤（按顺序）
- 成功的产物/标准（例如，不只是"写代码"，而是"一个 CI 完全通过的开放 PR"）
- 用户在哪里纠正或引导了您
- 需要什么工具和权限
- 使用了什么代理
- 目标和成功的产物是什么

### 步骤 2：采访用户

您将使用 AskUserQuestion 来了解用户想要自动化什么。重要说明：
- 所有问题都使用 AskUserQuestion！永远不要通过纯文本提问。
- 每一轮，根据需要迭代，直到用户满意。
- 用户总是有免费的"其他"选项来输入编辑或反馈 — 不要添加您自己的"需要调整"或"我将提供编辑"选项。只提供实质性选择。

**第 1 轮：高级别确认**
- 根据您的分析建议技能的名称和描述。让用户确认或重命名。
- 建议高级别目标和技能的具体成功标准。

**第 2 轮：更多细节**
- 将您识别的高级步骤作为编号列表呈现。告诉用户您将在下一轮深入细节。
- 如果您认为技能需要参数，根据您观察到的情况建议参数。确保您了解某人需要提供什么。
- 如果不清楚，询问此技能是应该内联运行（在当前对话中）还是分叉运行（作为具有自己上下文的子代理）。分叉更适合不需要过程中用户输入的自包含任务；内联更适合用户想要在过程中引导的情况。
- 询问技能应该保存在哪里。根据上下文建议默认值（仓库特定工作流 → 仓库，跨仓库个人工作流 → 用户）。选项：
  - **此仓库**（\`.claude/skills/<name>/SKILL.md\`）— 用于此项目特定的工作流
  - **个人**（\`~/.claude/skills/<name>/SKILL.md\`）— 跟随您跨所有仓库

**第 3 轮：分解每个步骤**
对于每个主要步骤，如果不是很明显，询问：
- 此步骤产生什么供后续步骤需要？（数据、产物、ID）
- 什么证明此步骤成功，我们可以继续？
- 是否应该在继续前询问用户确认？（特别是对于不可逆的操作，如合并、发送消息或破坏性操作）
- 是否有任何步骤是独立的，可以并行运行？（例如，同时发布到 Slack 并监控 CI）
- 技能应该如何执行？（例如，始终使用 Task 代理进行代码审查，或为一系列并发步骤调用代理团队）
- 有什么硬约束或硬偏好？必须发生或不能发生的事情？

您可以在此处进行多轮 AskUserQuestion，每轮一个步骤，特别是如果步骤超过 3 个或有很多澄清问题。根据需要迭代。

重要：特别注意会话中用户纠正您的地方，以帮助为您的设计提供信息。

**第 4 轮：最后的问题**
- 确认何时应该调用此技能，并建议/确认触发短语。（例如，对于 cherrypick 工作流，您可以说：当用户想要将 PR cherry-pick 到发布分支时使用。示例：'cherry-pick to release'、'CP this PR'、'hotfix'。）
- 您还可以询问是否有其他需要警惕的事情，如果仍然不清楚。

一旦有足够的信息就停止采访。重要：对于简单的流程，不要问太多！

### 步骤 3：编写 SKILL.md

在用户在第 2 轮选择的位置创建技能目录和文件。

使用此格式：

\`\`\`markdown
---
name: {{skill-name}}
description: {{单行描述}}
allowed-tools:
  {{会话期间观察到的工具权限模式列表}}
when_to_use: {{Claude 应自动调用此技能的详细描述，包括触发短语和示例用户消息}}
argument-hint: "{{显示参数占位符的提示}}"
arguments:
  {{参数名称列表}}
context: {{inline 或 fork -- 内联时省略}}
---

# {{技能标题}}
技能描述

## 输入
- \`$arg_name\`：此输入的描述

## 目标
清晰声明此工作流的目标。如果您有明确定义的产物或完成标准，最好。

## 步骤

### 1. 步骤名称
在此步骤中要做什么。具体且可操作。适当时包括命令。

**成功标准**：始终包含此项！这表明步骤完成，我们可以继续。可以是列表。

重要：有关每个步骤的可选注释，请参阅下一节。

...
\`\`\

**每步注释**：
- **成功标准**是每个步骤必需的。这有助于模型理解用户期望从他们的工作流中得到什么，以及何时应该有信心继续。
- **执行**：\`Direct\`（默认）、\`Task agent\`（简单的子代理）、\`Teammate\`（具有真正并行性和代理间通信的代理），或 \`[human]\`（用户做）。只有不是 Direct 时才需要指定。
- **产物**：此步骤产生供后续步骤需要的数据（例如 PR 编号、提交 SHA）。仅当后续步骤依赖时才包含。
- **人工检查点**：何时暂停并询问用户再继续。包括不可逆操作（合并、发送消息）、错误判断（合并冲突）或输出审查。
- **规则**：工作流的硬规则。参考会话期间的用户纠正特别有用。

**步骤结构提示**：
- 可以并发运行的步骤使用子编号：3a、3b
- 需要用户操作的步骤在标题中包含 \`[human]\`
- 保持简单技能简单 — 2 步技能不需要在每个步骤上都有注释

**Frontmatter 规则**：
- \`allowed-tools\`：所需的最少权限（使用类似 \`Bash(gh:*)\` 的模式，而不是 \`Bash\`）
- \`context\`：仅为不需要过程中用户输入的自包含技能设置 \`context: fork\`。
- \`when_to_use\` 是关键 — 告诉模型何时自动调用。以"Use when..."开头并包含触发短语。示例："当用户想要将 PR cherry-pick 到发布分支时使用。示例：'cherry-pick to release'、'CP this PR'、'hotfix'。"
- \`arguments\` 和 \`argument-hint\`：仅在技能需要参数时包括。在正文中使用 \`$name\` 进行替换。

### 步骤 4：确认和保存

在写文件之前，在响应中输出完整的 SKILL.md 内容作为 yaml 代码块，以便用户可以 proper 语法高亮查看它。然后使用 AskUserQuestion 询问确认，简单问题如"这个 SKILL.md 看起来可以保存吗？" — 不要使用 body 字段，保持问题简洁。

写完后，告诉用户：
- 技能保存在哪里
- 如何调用：\`/{{skill-name}} [参数]\`
- 他们可以直接编辑 SKILL.md 来优化它
`

export function registerSkillifySkill(): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  registerBundledSkill({
    name: 'skillify',
    description:
      '将此会话的可重复过程捕获到技能中。在要捕获的过程结束时调用，可选带描述。',
    allowedTools: [
      'Read',
      'Write',
      'Edit',
      'Glob',
      'Grep',
      'AskUserQuestion',
      'Bash(mkdir:*)',
    ],
    userInvocable: true,
    disableModelInvocation: true,
    argumentHint: '[您想要捕获的过程描述]',
    async getPromptForCommand(args, context) {
      const sessionMemory =
        (await getSessionMemoryContent()) ?? 'No session memory available.'
      const userMessages = extractUserMessages(
        getMessagesAfterCompactBoundary(context.messages),
      )

      const userDescriptionBlock = args
        ? `The user described this process as: "${args}"`
        : ''

      const prompt = SKILLIFY_PROMPT.replace('{{sessionMemory}}', sessionMemory)
        .replace('{{userMessages}}', userMessages.join('\n\n---\n\n'))
        .replace('{{userDescriptionBlock}}', userDescriptionBlock)

      return [{ type: 'text', text: prompt }]
    },
  })
}