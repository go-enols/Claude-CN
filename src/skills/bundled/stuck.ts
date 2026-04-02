import { registerBundledSkill } from '../bundledSkills.js'

// 提示文本包含 `ps` 命令作为给 Claude 运行的指令，
// 不是此文件执行的命令。
// eslint-disable-next-line custom-rules/no-direct-ps-commands
const STUCK_PROMPT = `# /stuck — 诊断冻结/缓慢的 Claude Code 会话

用户认为此机器上的另一个 Claude Code 会话冻结、卡住或非常慢。调查并发布报告到 #claude-code-feedback。

## 要查找的内容

扫描其他 Claude Code 进程（排除当前进程 — PID 在 \`process.pid\` 中，但对于 shell 命令，只需排除您看到运行此提示的 PID）。进程名称通常是 \`claude\`（已安装）或 \`cli\`（本机开发构建）。

卡住会话的迹象：
- **高 CPU（≥90%）持续** — 可能是无限循环。采样两次，间隔 1-2 秒，确认不是瞬时峰值。
- **进程状态 \`D\`（不可中断睡眠）** — 通常是 I/O 挂起。\`ps\` 输出中的 \`state\` 列；第一个字符很重要（忽略 \`+\`、\`s\`、\`<\` 等修饰符）。
- **进程状态 \`T\`（已停止）** — 用户可能意外按了 Ctrl+Z。
- **进程状态 \`Z\`（僵尸）** — 父进程没有回收。
- **非常高的 RSS（≥4GB）** — 可能的内存泄漏使会话变慢。
- **卡住的子进程** — 挂起的 \`git\`、\`node\` 或 shell 子进程可以冻结父进程。为每个会话检查 \`pgrep -lP <pid>\`。

## 调查步骤

1. **列出所有 Claude Code 进程**（macOS/Linux）：
   \`\`\`
   ps -axo pid=,pcpu=,rss=,etime=,state=,comm=,command= | grep -E '(claude|cli)' | grep -v grep
   \`\`\
   过滤 \`comm\` 为 \`claude\` 或（\`cli\` 且命令路径包含 "claude"）的行。

2. **对于任何可疑的**，收集更多上下文：
   - 子进程：\`pgrep -lP <pid>\`
   - 如果高 CPU：1-2 秒后再次采样确认是持续的
   - 如果子进程看起来挂起（例如 git 命令），用 \`ps -p <child_pid> -o command=\` 记下其完整命令行
   - 如果可以推断会话 ID，检查会话的调试日志：\`~/.claude/debug/<session-id>.txt\`（最后几百行通常显示挂起前它在做什么）

3. **考虑为真正冻结的进程获取堆栈转储**（高级，可选）：
   - macOS：\`sample <pid> 3\` 获取 3 秒的本机堆栈样本
   - 这很大 — 只在进程明显挂起且您想知道*为什么*时获取它

## 报告

**只有在真正发现卡住的内容时才发布到 Slack。** 如果每个会话看起来都健康，直接告诉用户 — 不要向频道发布解除警报。

如果您确实发现卡住/缓慢的会话，使用 Slack MCP 工具发布到 **#claude-code-feedback**（频道 ID：\`C07VBSHV7EV\`）。使用 ToolSearch 查找 \`slack_send_message\`（如果尚未加载）。

**使用两条消息结构**以保持频道可扫描：

1. **顶级消息** — 一行简短：主机名、Claude Code 版本和简洁的症状（例如 "session PID 12345 持续 100% CPU 10 分钟" 或 "git 子进程在 D 状态挂起"）。无代码块，无详情。
2. **线程回复** — 完整的诊断转储。将顶级消息的 \`ts\` 传递为 \`thread_ts\`。包括：
   - PID、CPU%、RSS、状态、正常运行时间、命令行、子进程
   - 您对可能问题的诊断
   - 相关调试日志尾部或您捕获的 \`sample\` 输出

如果 Slack MCP 不可用，将报告格式化为用户可以复制粘贴到 #claude-code-feedback 的消息（并让他们知道自行线程化详情）。

## 备注
- 不要杀死或向任何进程发送信号 — 这只是诊断。
- 如果用户提供了参数（例如特定 PID 或症状），首先关注那里。
`

export function registerStuckSkill(): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  registerBundledSkill({
    name: 'stuck',
    description:
      '[仅 ANT] 调查此机器上冻结/卡住/缓慢的 Claude Code 会话，并将诊断报告发布到 #claude-code-feedback。',
    userInvocable: true,
    async getPromptForCommand(args) {
      let prompt = STUCK_PROMPT
      if (args) {
        prompt += `\n## 用户提供的上下文\n\n${args}\n`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}