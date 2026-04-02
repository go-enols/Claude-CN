import {
  CRON_CREATE_TOOL_NAME,
  CRON_DELETE_TOOL_NAME,
  DEFAULT_MAX_AGE_DAYS,
  isKairosCronEnabled,
} from '../../tools/ScheduleCronTool/prompt.js'
import { registerBundledSkill } from '../bundledSkills.js'

const DEFAULT_INTERVAL = '10m'

const USAGE_MESSAGE = `用法：/loop [间隔] <提示>

按重复间隔运行提示或斜杠命令。

间隔：Ns、Nm、Nh、Nd（例如 5m、30m、2h、1d）。最小粒度为 1 分钟。
如果未指定间隔，默认为 ${DEFAULT_INTERVAL}。

示例：
  /loop 5m /babysit-prs
  /loop 30m check the deploy
  /loop 1h /standup 1
  /loop check the deploy          (默认为 ${DEFAULT_INTERVAL})
  /loop check the deploy every 20m`

function buildPrompt(args: string): string {
  return `# /loop — 计划重复提示

将下面的输入解析为 \`[间隔] <提示…>\` 并使用 ${CRON_CREATE_TOOL_NAME} 计划它。

## 解析（按优先级）

1. **前导标记**：如果第一个空格分隔的标记匹配 \`^\\d+[smhd]$\`（例如 \`5m\`、\`2h\`），那是间隔；其余的是提示。
2. **尾部 "every" 子句**：否则，如果输入以 \`every <N><unit>\` 或 \`every <N> <unit-word>\`（例如 \`every 20m\`、\`every 5 minutes\`、\`every 2 hours\`）结尾，提取它作为间隔并从提示中剥离。只有当"every"后面是时间表达式时才匹配 — \`check every PR\` 没有间隔。
3. **默认**：否则，间隔为 \`${DEFAULT_INTERVAL}\`，整个输入是提示。

如果结果提示为空，显示用法 \`/loop [interval] <prompt>\` 并停止 — 不要调用 ${CRON_CREATE_TOOL_NAME}。

示例：
- \`5m /babysit-prs\` → 间隔 \`5m\`，提示 \`/babysit-prs\`（规则 1）
- \`check the deploy every 20m\` → 间隔 \`20m\`，提示 \`check the deploy\`（规则 2）
- \`run tests every 5 minutes\` → 间隔 \`5m\`，提示 \`run tests\`（规则 2）
- \`check the deploy\` → 间隔 \`${DEFAULT_INTERVAL}\`，提示 \`check the deploy\`（规则 3）
- \`check every PR\` → 间隔 \`${DEFAULT_INTERVAL}\`，提示 \`check every PR\`（规则 3 — "every" 后面不是时间）
- \`5m\` → 空提示 → 显示用法

## 间隔 → cron

支持的后缀：\`s\`（秒，向上取整到最近的分钟，最小 1）、\`m\`（分钟）、\`h\`（小时）、\`d\`（天）。转换：

| 间隔模式            | Cron 表达式           | 备注                                    |
|---------------------|---------------------|------------------------------------------|
| \`Nm\` 其中 N ≤ 59   | \`*/N * * * *\`     | 每 N 分钟                                |
| \`Nm\` 其中 N ≥ 60   | \`0 */H * * *\`     | 四舍五入到小时（H = N/60，必须整除 24）|
| \`Nh\` 其中 N ≤ 23   | \`0 */N * * *\`     | 每 N 小时                                |
| \`Nd\`               | \`0 0 */N * *\`     | 当地时间每 N 天午夜                      |
| \`Ns\`               | 视为 \`ceil(N/60)m\` | cron 最小粒度为 1 分钟                  |

**如果间隔不能整除其单位**（例如 \`7m\` → \`*/7 * * * *\` 在 :56→:00 产生不均匀间隙；\`90m\` → 1.5 小时，cron 无法表达），选择最近的干净间隔并在计划前告诉用户四舍五入到什么。

## 行动

1. 使用以下参数调用 ${CRON_CREATE_TOOL_NAME}：
   - \`cron\`：上表中的表达式
   - \`prompt\`：上面解析的提示，逐字传递（斜杠命令原样传递）
   - \`recurring\`：\`true\`
2. 简要确认：计划的内容、cron 表达式、人类可读的节奏、重复任务在 ${DEFAULT_MAX_AGE_DAYS} 天后自动过期，以及他们可以使用 ${CRON_DELETE_TOOL_NAME} 更快取消（包括作业 ID）。
3. **然后立即执行解析后的提示** — 不要等待第一次 cron 触发。如果是斜杠命令，通过 Skill 工具调用它；否则直接执行。

## 输入

${args}`
}

export function registerLoopSkill(): void {
  registerBundledSkill({
    name: 'loop',
    description:
      '按重复间隔运行提示或斜杠命令（例如 /loop 5m /foo，默认为 10m）',
    whenToUse:
      '当用户想要设置重复任务、轮询状态或按间隔重复运行某些内容时（例如"每 5 分钟检查部署"、"持续运行 /babysit-prs"）。不要为一次性任务调用。',
    argumentHint: '[interval] <prompt>',
    userInvocable: true,
    isEnabled: isKairosCronEnabled,
    async getPromptForCommand(args) {
      const trimmed = args.trim()
      if (!trimmed) {
        return [{ type: 'text', text: USAGE_MESSAGE }]
      }
      return [{ type: 'text', text: buildPrompt(trimmed) }]
    },
  })
}