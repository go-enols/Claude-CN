import { AGENT_TOOL_NAME } from '../../tools/AgentTool/constants.js'
import { ASK_USER_QUESTION_TOOL_NAME } from '../../tools/AskUserQuestionTool/prompt.js'
import { ENTER_PLAN_MODE_TOOL_NAME } from '../../tools/EnterPlanModeTool/constants.js'
import { EXIT_PLAN_MODE_TOOL_NAME } from '../../tools/ExitPlanModeTool/constants.js'
import { SKILL_TOOL_NAME } from '../../tools/SkillTool/constants.js'
import { getIsGit } from '../../utils/git.js'
import { registerBundledSkill } from '../bundledSkills.js'

const MIN_AGENTS = 5
const MAX_AGENTS = 30

const WORKER_INSTRUCTIONS = `完成实现更改后：
1. **简化** — 使用 \`skill: "simplify"\` 调用 \`${SKILL_TOOL_NAME}\` 工具来审查和清理您的更改。
2. **运行单元测试** — 运行项目的测试套件（检查 package.json 脚本、Makefile 目标，或常见命令如 \`npm test\`、\`bun test\`、\`pytest\`、\`go test\`）。如果测试失败，请修复它们。
3. **端到端测试** — 按照协调器提示中的端到端测试方案进行（见下文）。如果方案说为此单元跳过 e2e，请跳过它。
4. **提交并推送** — 用清晰的消息提交所有更改，推送分支，并使用 \`gh pr create\` 创建 PR。使用描述性标题。如果 \`gh\` 不可用或推送失败，请在最终消息中注明。
5. **报告** — 以单行结束：\`PR: <url>\` 以便协调器可以跟踪它。如果没有创建 PR，以 \`PR: none — <reason>\` 结束。`

function buildPrompt(instruction: string): string {
  return `# 批处理：并行工作编排

您正在跨代码库编排一个大型的、可并行的更改。

## 用户指令

${instruction}

## 阶段 1：研究和计划（计划模式）

现在调用 \`${ENTER_PLAN_MODE_TOOL_NAME}\` 工具进入计划模式，然后：

1. **了解范围。** 启动一个或多个子代理（在前台 — 您需要它们的结果）来深入研究此指令涉及的内容。找到所有需要更改的文件、模式和调用站点。了解现有约定，以便迁移保持一致。

2. **分解为独立单元。** 将工作分解为 ${MIN_AGENTS}–${MAX_AGENTS} 个自包含单元。每个单元必须：
   - 可以在隔离的 git worktree 中独立实现（与同级单元无共享状态）
   - 可以独立合并，无需依赖另一个单元的 PR 首先落地
   - 大小大致均匀（拆分大单元，合并小单元）

   根据实际工作调整数量：少文件 → 接近 ${MIN_AGENTS}；数百文件 → 接近 ${MAX_AGENTS}。更喜欢按目录或模块切片，而非任意文件列表。

3. **确定端到端测试方案。** 弄清楚工作者如何端到端验证其更改是否真正有效 — 不仅仅是单元测试通过。查找：
   - \`claude-in-chrome\` 技能或浏览器自动化工具（用于 UI 更改：点击受影响的流程，截图结果）
   - \`tmux\` 或 CLI 验证器技能（用于 CLI 更改：交互式启动应用程序，练习更改的行为）
   - dev-server + curl 模式（用于 API 更改：启动服务器，访问受影响的端点）
   - 工作者可以运行的现有 e2e/集成测试套件

   如果找不到具体的端到端路径，使用 \`${ASK_USER_QUESTION_TOOL_NAME}\` 工具询问用户如何端到端验证此更改。根据您找到的内容提供 2-3 个具体选项（例如，"通过 chrome 扩展截图"、"运行 \`bun run dev\` 并 curl 端点"、"无 e2e — 单元测试足够"）。不要跳过此步骤 — 工作者无法自行询问用户。

   将方案写为一组简短的、具体的步骤，工作者可以自主执行。包括任何设置（先启动 dev 服务器、构建）和确切的命令/交互以进行验证。

4. **写计划。** 在计划文件中包括：
   - 研究期间发现的摘要
   - 工作单元编号列表 — 每个：简短标题、覆盖的文件/目录列表，以及更改的一行描述
   - 端到端测试方案（或"跳过 e2e，因为 …"如果用户选择）
   - 您将给每个代理的确切工作者指令（共享模板）

5. 调用 \`${EXIT_PLAN_MODE_TOOL_NAME}\` 展示计划以供批准。

## 阶段 2：生成工作者（计划批准后）

计划批准后，使用 \`${AGENT_TOOL_NAME}\` 工具为每个工作单元生成一个后台代理。**所有代理必须使用 \`isolation: "worktree"\` 和 \`run_in_background: true\`。** 在单条消息块中启动它们，以便并行运行。

对于每个代理，提示必须完全自包含。包括：
- 总体目标（用户指令）
- 本单元的具体任务（标题、文件列表、更改描述 — 从计划中逐字复制）
- 工作者需要遵循的代码库约定
- 计划中的端到端测试方案（或"跳过 e2e，因为 …"）
- 下面的工作者指令，逐字复制：

\`\`\`
${WORKER_INSTRUCTIONS}
\`\`\

使用 \`subagent_type: "general-purpose"\`，除非更具体的代理类型更合适。

## 阶段 3：跟踪进度

启动所有工作者后，渲染初始状态表：

| # | 单元 | 状态 | PR |
|---|------|------|-----|
| 1 | <标题> | 运行中 | — |
| 2 | <标题> | 运行中 | — |

当后台代理完成通知到达时，解析每个代理结果中的 \`PR: <url>\` 行，并用更新状态（\`done\` / \`failed\`）和 PR 链接重新渲染表。为任何未产生 PR 的代理保留简要失败说明。

所有代理都报告后，渲染最终表和一行的摘要（例如，"22/24 单元作为 PR 落地"）。
`
}
const NOT_A_GIT_REPO_MESSAGE = `这不是 git 仓库。\`/batch\` 命令需要 git 仓库，因为它在隔离的 git worktree 中生成代理，并从每个代理创建 PR。先初始化一个仓库，或在现有仓库内运行。`

const MISSING_INSTRUCTION_MESSAGE = `提供描述您要进行的批量更改的指令。

示例：
  /batch 从 react 迁移到 vue
  /batch 将所有 lodash 用法替换为原生等价物
  /batch 为所有未类型化的函数参数添加类型注解`

export function registerBatchSkill(): void {
  registerBundledSkill({
    name: 'batch',
    description:
      '研究和计划大规模更改，然后通过 5–30 个隔离的 worktree 代理并行执行，每个代理都会打开一个 PR。',
    whenToUse:
      '当用户想要跨许多文件进行全面的、机械性的更改（迁移、重构、批量重命名）时可以分解为独立的并行单元时使用。',
    argumentHint: '<instruction>',
    userInvocable: true,
    disableModelInvocation: true,
    async getPromptForCommand(args) {
      const instruction = args.trim()
      if (!instruction) {
        return [{ type: 'text', text: MISSING_INSTRUCTION_MESSAGE }]
      }

      const isGit = await getIsGit()
      if (!isGit) {
        return [{ type: 'text', text: NOT_A_GIT_REPO_MESSAGE }]
      }

      return [{ type: 'text', text: buildPrompt(instruction) }]
    },
  })
}