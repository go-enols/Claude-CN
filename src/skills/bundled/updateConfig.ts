import { toJSONSchema } from 'zod/v4'
import { SettingsSchema } from '../../utils/settings/types.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { registerBundledSkill } from '../bundledSkills.js'

/**
 * 从 settings Zod 模式生成 JSON Schema。
 * 这使技能提示与实际类型保持同步。
 */
function generateSettingsSchema(): string {
  const jsonSchema = toJSONSchema(SettingsSchema(), { io: 'input' })
  return jsonStringify(jsonSchema, null, 2)
}

const SETTINGS_EXAMPLES_DOCS = `## 设置文件位置

根据范围选择适当的文件：

| 文件 | 范围 | Git | 用于 |
|------|------|-----|------|
| \`~/.claude/settings.json\` | 全局 | 不适用 | 所有项目的个人偏好 |
| \`.claude/settings.json\` | 项目 | 提交 | 团队范围的钩子、权限、插件 |
| \`.claude/settings.local.json\` | 项目 | Gitignore | 此项目的个人覆盖 |

设置加载顺序：user → project → local（后面的覆盖前面的）。

## 设置模式参考

### 权限
\`\`\`json
{
  "permissions": {
    "allow": ["Bash(npm:*)", "Edit(.claude)", "Read"],
    "deny": ["Bash(rm -rf:*)"],
    "ask": ["Write(/etc/*)"],
    "defaultMode": "default" | "plan" | "acceptEdits" | "dontAsk",
    "additionalDirectories": ["/extra/dir"]
  }
}
\`\`\`

**权限规则语法：**
- 精确匹配：\`"Bash(npm run test)"\`
- 前缀通配符：\`"Bash(git:*)"\` — 匹配 \`git status\`、\`git commit\` 等
- 仅工具：\`"Read"\` — 允许所有读取操作

### 环境变量
\`\`\`json
{
  "env": {
    "DEBUG": "true",
    "MY_API_KEY": "value"
  }
}
\`\`\`

### 模型和代理
\`\`\`json
{
  "model": "sonnet",  // 或 "opus"、"haiku"、完整模型 ID
  "agent": "agent-name",
  "alwaysThinkingEnabled": true
}
\`\`\`

### 归因（提交和 PR）
\`\`\`json
{
  "attribution": {
    "commit": "自定义提交拖车文本",
    "pr": "自定义 PR 描述文本"
  }
}
\`\`\`
将 \`commit\` 或 \`pr\` 设置为空字符串 \`""\` 以隐藏该归因。

### MCP 服务器管理
\`\`\`json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["server1", "server2"],
  "disabledMcpjsonServers": ["blocked-server"]
}
\`\`\`

### 插件
\`\`\`json
{
  "enabledPlugins": {
    "formatter@anthropic-tools": true
  }
}
\`\`\`
插件语法：\`plugin-name@source\`，其中 source 是 \`claude-code-marketplace\`、\`claude-plugins-official\` 或 \`builtin\`。

### 其他设置
- \`language\`：首选响应语言（例如 "japanese"）
- \`cleanupPeriodDays\`：保留记录的天数（默认：30；0 完全禁用持久化）
- \`respectGitignore\`：是否尊重 .gitignore（默认：true）
- \`spinnerTipsEnabled\`：在微调器中显示提示
- \`spinnerVerbs\`：自定义微调器动词（\`{ "mode": "append" | "replace", "verbs": [...] }\`）
- \`spinnerTipsOverride\`：覆盖微调器提示（\`{ "excludeDefault": true, "tips": ["Custom tip"] }\`）
- \`syntaxHighlightingDisabled\`：禁用差异高亮
`

// 注意：我们为常见模式保留手写示例，因为它们比自动生成的模式文档更可操作。
// 生成的模式列表提供完整性，而示例提供清晰度。

const HOOKS_DOCS = `## 钩子配置

钩子在 Claude Code 生命周期的特定点运行命令。

### 钩子结构
\`\`\`json
{
  "hooks": {
    "EVENT_NAME": [
      {
        "matcher": "ToolName|OtherTool",
        "hooks": [
          {
            "type": "command",
            "command": "your-command-here",
            "timeout": 60,
            "statusMessage": "Running..."
          }
        ]
      }
    ]
  }
}
\`\`\`

### 钩子事件

| 事件 | 匹配器 | 目的 |
|-------|---------|------|
| PermissionRequest | 工具名称 | 权限提示前运行 |
| PreToolUse | 工具名称 | 工具前运行，可以阻止 |
| PostToolUse | 工具名称 | 工具成功运行后 |
| PostToolUseFailure | 工具名称 | 工具失败后 |
| Notification | 通知类型 | 通知时运行 |
| Stop | - | Claude 停止时运行（包括 clear、resume、compact）|
| PreCompact | "manual"/"auto" | 压缩前 |
| PostCompact | "manual"/"auto" | 压缩后（接收摘要）|
| UserPromptSubmit | - | 用户提交时 |
| SessionStart | - | 会话开始时 |

**常见工具匹配器：** \`Bash\`、\`Write\`、\`Edit\`、\`Read\`、\`Glob\`、\`Grep\`

### 钩子类型

**1. 命令钩子** - 运行 shell 命令：
\`\`\`json
{ "type": "command", "command": "prettier --write $FILE", "timeout": 30 }
\`\`\`

**2. 提示钩子** - 使用 LLM 评估条件：
\`\`\`json
{ "type": "prompt", "prompt": "Is this safe? $ARGUMENTS" }
\`\`\`
仅适用于工具事件：PreToolUse、PostToolUse、PermissionRequest。

**3. 代理钩子** - 使用工具运行代理：
\`\`\`json
{ "type": "agent", "prompt": "Verify tests pass: $ARGUMENTS" }
\`\`\`
仅适用于工具事件：PreToolUse、PostToolUse、PermissionRequest。

### 钩子输入（stdin JSON）
\`\`\`json
{
  "session_id": "abc123",
  "tool_name": "Write",
  "tool_input": { "file_path": "/path/to/file.txt", "content": "..." },
  "tool_response": { "success": true }  // 仅 PostToolUse
}
\`\`\`

### 钩子 JSON 输出

钩子可以返回 JSON 来控制行为：

\`\`\`json
{
  "systemMessage": "UI 中向用户显示的警告",
  "continue": false,
  "stopReason": "阻止时显示的消息",
  "suppressOutput": false,
  "decision": "block",
  "reason": "决定的解释",
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "注入回模型的上下文"
  }
}
\`\`\`

**字段：**
- \`systemMessage\` - 向用户显示消息（所有钩子）
- \`continue\` - 设置为 \`false\` 阻止/停止（默认：true）
- \`stopReason\` - \`continue\` 为 false 时显示的消息
- \`suppressOutput\` - 从记录中隐藏 stdout（默认：false）
- \`decision\` - "block" 用于 PostToolUse/Stop/UserPromptSubmit 钩子（已弃用用于 PreToolUse，改用 hookSpecificOutput.permissionDecision）
- \`reason\` - 决定的解释
- \`hookSpecificOutput\` - 事件特定输出（必须包含 \`hookEventName\`）：
  - \`additionalContext\` - 注入模型上下文的文本
  - \`permissionDecision\` - "allow"、"deny" 或 "ask"（仅 PreToolUse）
  - \`permissionDecisionReason\` - 权限决定的原因（仅 PreToolUse）
  - \`updatedInput\` - 修改后的工具输入（仅 PreToolUse）

### 常见模式

**写入后自动格式化：**
\`\`\`json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_response.filePath // .tool_input.file_path' | { read -r f; prettier --write \\"$f\\"; } 2>/dev/null || true"
      }]
    }]
  }
}
\`\`\`

**记录所有 bash 命令：**
\`\`\`json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.command' >> ~/.claude/bash-log.txt"
      }]
    }]
  }
}
\`\`\`

**显示消息给用户的停止钩子：**

命令必须输出带有 \`systemMessage\` 字段的 JSON：
\`\`\`bash
# 输出示例：{"systemMessage": "Session complete!"}
echo '{"systemMessage": "Session complete!"}'
\`\`\`

**代码更改后运行测试：**
\`\`\`json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_input.file_path // .tool_response.filePath' | grep -E '\\\\.(ts|js)$' && npm test || true"
      }]
    }]
  }
}
\`\`\`
`

const HOOK_VERIFICATION_FLOW = `## 构建钩子（带验证）

给定事件、匹配器、目标文件和所需行为，按此流程进行。每一步捕获不同的失败类别 — 静默不作为的钩子比没有钩子更糟糕。

1. **去重检查。** 读取目标文件。如果同一事件+匹配器上已存在钩子，显示现有命令并询问：保留、替换还是追加。

2. **为此项目构建命令 — 不要假设。** 钩子通过 stdin 接收 JSON。构建一个命令：
   - 安全提取任何需要的有效载荷 — 使用 \`jq -r\` 到带引号的变量或 \`{ read -r f; ... "$f"; }\`，而不是无引号的 \`| xargs\`（在空格上分割）
   - 以此项目运行底层工具的方式调用它（npx/bunx/yarn/pnpm？Makefile 目标？全局安装？）
   - 跳过工具不处理的输入（格式化器通常有 \`--ignore-unknown\`；如果没有，按扩展名保护）
   - 暂时保持原始 — 没有 \`|| true\`，没有 stderr 抑制。管道测试通过后再包装。

3. **管道测试原始命令。** 综合钩子将接收的 stdin 有效载荷并直接管道：
   - \`Pre|PostToolUse\` 关于 \`Write|Edit\`：\`echo '{"tool_name":"Edit","tool_input":{"file_path":"<此仓库中的真实文件>"}}' | <cmd>\`
   - \`Pre|PostToolUse\` 关于 \`Bash\`：\`echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | <cmd>\`
   - \`Stop\`/\`UserPromptSubmit\`/\`SessionStart\`：大多数命令不读取 stdin，因此 \`echo '{}' | <cmd>\` 足够

   检查退出代码和副作用（文件实际格式化，测试实际运行）。如果失败，你会得到真实错误 — 修复（错误的包管理器？工具未安装？jq 路径错误？）并重新测试。一旦它工作，用 \`2>/dev/null || true\` 包装（除非用户想要阻塞检查）。

4. **编写 JSON。** 合并到目标文件（上面"钩子结构"部分中的模式形状）。如果这是首次创建 \`.claude/settings.local.json\`，将其添加到 .gitignore — Write 工具不会自动将其添加到 gitignore。

5. **一次验证语法+模式：**

   \`jq -e '.hooks.<event>[] | select(.matcher == "<matcher>") | .hooks[] | select(.type == "command") | .command' <target-file>\`

   退出 0 + 打印你的命令 = 正确。退出 4 = 匹配器不匹配。退出 5 = 格式错误的 JSON 或错误的嵌套。损坏的 settings.json 会静默禁用该文件的所有设置 — 修复任何预先存在的格式错误。

6. **证明钩子触发** — 仅适用于你可以依次触发的匹配器上的 \`Pre|PostToolUse\`（\`Write|Edit\` 通过 Edit，\`Bash\` 通过 Bash）。\`Stop\`/\`UserPromptSubmit\`/\`SessionStart\` 在这一轮之外触发 — 跳到步骤 7。

   对于 \`PostToolUse\`/\`Write|Edit\` 上的**格式化器**：通过 Edit 引入可检测的违规（两个连续空行、糟糕的缩进、缺少分号 — 格式化器会纠正的内容；不是尾随空白，Edit 在写入前会剥离），重新读取，确认钩子**修复**了它。对于**其他任何东西**：暂时在 settings.json 中为命令添加前缀 \`echo "$(date) hook fired" >> /tmp/claude-hook-check.txt; \`，触发匹配工具（\`Write|Edit\` 用 Edit，\`Bash\` 用无害的 \`true\`），读取哨兵文件。

   **始终清理** — 恢复违规，剥离哨兵前缀 — 无论证明通过还是失败。

   **如果证明失败但管道测试通过且 \`jq -e\` 通过**：设置监视器不在监视 \`.claude/\` — 它只监视会话开始时已有设置文件的目录。钩子编写正确。告诉用户打开 \`/hooks\` 一次（重新加载配置）或重启 — 你无法自己执行此操作；\`/hooks\` 是用户 UI 菜单，打开它会结束这一轮。

7. **交接。** 告诉用户钩子已生效（或根据监视器警告需要 \`/hooks\`/重启）。指向 \`/hooks\` 以便他们之后可以查看、编辑或禁用它。UI 仅在钩子错误或缓慢时显示"运行了 N 个钩子" — 静默成功按设计是不可见的。
`

const UPDATE_CONFIG_PROMPT = `# 更新配置技能

通过更新 settings.json 文件修改 Claude Code 配置。

## 何时需要钩子（不是记忆）

如果用户希望某事自动响应事件发生，他们需要在 settings.json 中配置一个**钩子**。记忆/偏好无法触发自动化操作。

**这些需要钩子：**
- "压缩前，问我保留什么" → PreCompact 钩子
- "写入文件后，运行 prettier" → 带 Write|Edit 匹配器的 PostToolUse 钩子
- "当我运行 bash 命令时，记录它们" → 带 Bash 匹配器的 PreToolUse 钩子
- "始终在代码更改后运行测试" → PostToolUse 钩子

**钩子事件：** PreToolUse、PostToolUse、PreCompact、PostCompact、Stop、Notification、SessionStart

## 重要：写入前先阅读

**在进行更改之前始终读取现有设置文件。** 将新设置与现有设置合并 — 永远不要替换整个文件。

## 重要：使用 AskUserQuestion 处理歧义

当用户的请求不明确时，使用 AskUserQuestion 来澄清：
- 修改哪个设置文件（user/project/local）
- 是添加到现有数组还是替换它们
- 存在多个选项时的具体值

## 决策：配置工具还是直接编辑

**对这些简单设置使用配置工具：**
- \`theme\`、\`editorMode\`、\`verbose\`、\`model\`
- \`language\`、\`alwaysThinkingEnabled\`
- \`permissions.defaultMode\`

**直接编辑 settings.json：**
- 钩子（PreToolUse、PostToolUse 等）
- 复杂权限规则（allow/deny 数组）
- 环境变量
- MCP 服务器配置
- 插件配置

## 工作流程

1. **澄清意图** — 询问请求是否不明确
2. **读取现有文件** — 使用 Read 工具读取目标设置文件
3. **仔细合并** — 保留现有设置，特别是数组
4. **编辑文件** — 使用 Edit 工具（如果文件不存在，要求用户先创建）
5. **确认** — 告诉用户更改了什么

## 合并数组（重要！）

添加到权限数组或钩子数组时，**与现有合并**，不要替换：

**错误**（替换现有权限）：
\`\`\`json
{ "permissions": { "allow": ["Bash(npm:*)"] } }
\`\`\`

**正确**（保留现有 + 添加新的）：
\`\`\`json
{
  "permissions": {
    "allow": [
      "Bash(git:*)",      // 现有
      "Edit(.claude)",    // 现有
      "Bash(npm:*)"       // 新的
    ]
  }
}
\`\`\`

${SETTINGS_EXAMPLES_DOCS}

${HOOKS_DOCS}

${HOOK_VERIFICATION_FLOW}

## 示例工作流程

### 添加钩子

用户："Claude 写入后格式化我的代码"

1. **澄清**：哪个格式化器？（prettier、gofmt 等）
2. **读取**：\`.claude/settings.json\`（如果缺失则创建）
3. **合并**：添加到现有钩子，不要替换
4. **结果**：
\`\`\`json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "jq -r '.tool_response.filePath // .tool_input.file_path' | { read -r f; prettier --write \\"$f\\"; } 2>/dev/null || true"
      }]
    }]
  }
}
\`\`\`

### 添加权限

用户："允许 npm 命令而无需提示"

1. **读取**：现有权限
2. **合并**：将 \`Bash(npm:*)\` 添加到 allow 数组
3. **结果**：与现有允许合并

### 环境变量

用户："设置 DEBUG=true"

1. **决定**：用户设置（全局）还是项目设置？
2. **读取**：目标文件
3. **合并**：添加到 env 对象
\`\`\`json
{ "env": { "DEBUG": "true" } }
\`\`\`

## 要避免的常见错误

1. **替换而非合并** — 始终保留现有设置
2. **错误的文件** — 如果范围不清楚，询问用户
3. **无效 JSON** — 更改后验证语法
4. **忘记先读取** — 始终在写入前读取

## 钩子故障排除

如果钩子未运行：
1. **检查设置文件** — 读取 ~/.claude/settings.json 或 .claude/settings.json
2. **验证 JSON 语法** — 无效 JSON 会静默失败
3. **检查匹配器** — 是否匹配工具名称？（例如 "Bash"、"Write"、"Edit"）
4. **检查钩子类型** — 是 "command"、"prompt" 还是 "agent"？
5. **测试命令** — 手动运行钩子命令看它是否有效
6. **使用 --debug** — 运行 \`claude --debug\` 查看钩子执行日志
`

export function registerUpdateConfigSkill(): void {
  registerBundledSkill({
    name: 'update-config',
    description:
      '使用此技能通过 settings.json 配置 Claude Code 自动化行为。自动化行为（"从现在开始当 X"、"每次 X"、"每当 X"、"在 X 之前/之后"）需要在 settings.json 中配置钩子 — 这些由 harness 执行，不是 Claude，所以记忆/偏好无法满足。也用于：权限（"允许 X"、"添加权限"、"移动权限到"）、环境变量（"设置 X=Y"）、钩子故障排除，或对 settings.json/settings.local.json 文件进行任何更改。示例："允许 npm 命令"、"将 bq 权限添加到全局设置"、"将权限移动到用户设置"、"设置 DEBUG=true"、"当 claude 停止时显示 X"。对于简单设置如 theme/model，使用 Config 工具。',
    allowedTools: ['Read'],
    userInvocable: true,
    async getPromptForCommand(args) {
      if (args.startsWith('[hooks-only]')) {
        const req = args.slice('[hooks-only]'.length).trim()
        let prompt = HOOKS_DOCS + '\n\n' + HOOK_VERIFICATION_FLOW
        if (req) {
          prompt += `\n\n## 任务\n\n${req}`
        }
        return [{ type: 'text', text: prompt }]
      }

      // 动态生成模式以与类型保持同步
      const jsonSchema = generateSettingsSchema()

      let prompt = UPDATE_CONFIG_PROMPT
      prompt += `\n\n## 完整设置 JSON Schema\n\n\`\`\`json\n${jsonSchema}\n\`\`\``

      if (args) {
        prompt += `\n\n## 用户请求\n\n${args}`
      }

      return [{ type: 'text', text: prompt }]
    },
  })
}