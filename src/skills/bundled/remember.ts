import { isAutoMemoryEnabled } from '../../memdir/paths.js'
import { registerBundledSkill } from '../bundledSkills.js'

export function registerRememberSkill(): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  const SKILL_PROMPT = `# 记忆回顾

## 目标
回顾用户的记忆景观，并生成按操作类型分组的清晰更改提案报告。不要应用更改 — 呈现提案以供用户批准。

## 步骤

### 1. 收集所有记忆层
从项目根目录读取 CLAUDE.md 和 CLAUDE.local.md（如果存在）。您的自动记忆内容已在您的系统提示中 — 在那里查看。注意是否存在团队记忆部分。

**成功标准**：您拥有所有记忆层的内容并可以比较它们。

### 2. 对每个自动记忆条目进行分类
对于自动记忆中的每个实质性条目，确定最佳目标：

| 目标 | 什么应该放在那里 | 示例 |
|---|---|---|
| **CLAUDE.md** | 所有贡献者应遵循的 Claude 项目约定和指令 | "使用 bun 而非 npm"，"API 路由使用 kebab-case"，"测试命令是 bun test"，"更喜欢函数式风格" |
| **CLAUDE.local.md** | 特定于此用户的个人指令，不适用于其他贡献者 | "我更喜欢简洁的回复"，"始终解释权衡"，"不要自动提交"，"提交前运行测试" |
| **团队记忆** | 跨仓库适用的组织范围知识（仅在配置了团队记忆时） | "PR 通过 #deploy-queue 部署"，"staging 位于 staging.internal"，"平台团队拥有 infra" |
| **保留在自动记忆** | 工作笔记、临时上下文或不明确适合其他地方的条目 | 会议特定的观察、不确定的模式 |

**重要区别：**
- CLAUDE.md 和 CLAUDE.local.md 包含给 Claude 的指令，不是用户对外部工具的偏好（编辑器主题、IDE 快捷键等不属于其中任一个）
- 工作流程实践（PR 约定、合并策略、分支命名）是模糊的 — 询问用户它们是个人还是团队范围
- 不确定时，询问而不是猜测

**成功标准**：每个条目都有建议的目标或标记为模糊。

### 3. 识别清理机会
扫描所有层以查找：
- **重复**：自动记忆条目已捕获在 CLAUDE.md 或 CLAUDE.local.md 中 → 建议从自动记忆中移除
- **过时**：CLAUDE.md 或 CLAUDE.local.md 条目被更新的自动记忆条目矛盾 → 建议更新较旧的层
- **冲突**：任何两层之间的矛盾 → 建议解决方案，注明哪个更新

**成功标准**：识别所有跨层问题。

### 4. 呈现报告
输出按操作类型分组的结构化报告：
1. **提升** — 要移动的条目，带有目标和理由
2. **清理** — 要解决的重复、过时条目、冲突
3. **模糊** — 需要用户输入目标位置的条目
4. **无需操作** — 关于应保留在原位的条目的简要说明

如果自动记忆为空，这样说并提供审查 CLAUDE.md 进行清理。

**成功标准**：用户可以单独审查和批准/拒绝每个提案。

## 规则
- 在进行任何更改之前呈现所有提案
- 未经用户明确批准，不要修改文件
- 除非目标尚不存在，否则不要创建新文件
- 询问模糊条目 — 不要猜测
`

  registerBundledSkill({
    name: 'remember',
    description:
      '审查自动记忆条目并建议提升到 CLAUDE.md、CLAUDE.local.md 或共享记忆。还检测记忆层之间的过时、冲突和重复条目。',
    whenToUse:
      '当用户想要审查、组织或提升他们的自动记忆条目时使用。也可用于清理 CLAUDE.md、CLAUDE.local.md 和自动记忆之间的过时或冲突条目。',
    userInvocable: true,
    isEnabled: () => isAutoMemoryEnabled(),
    async getPromptForCommand(args) {
      let prompt = SKILL_PROMPT

      if (args) {
        prompt += `\n## 来自用户的额外上下文\n\n${args}`
      }

      return [{ type: 'text', text: prompt }]
    },
  })
}