#!/usr/bin/env python3
"""
安全翻译脚本 - 只翻译用户可见的英文UI文本
确保不翻译变量名、函数名、注释等代码元素
"""

source_file = '/workspace/localization_work/source_repo/src/main.tsx'
target_file = '/workspace/localization_work/target_repo/src/main.tsx'

with open(source_file, 'r', encoding='utf-8') as f:
    content = f.read()

# 翻译映射表 - 按长度从长到短排序，确保长字符串先匹配
# 只包含用户可见的文本，不包含变量名、函数名等
translations = [
    # ========== 主命令描述和选项 ==========
    ("Claude Code - starts an interactive session by default, use -p/--print for non-interactive output",
     "Claude Code - 默认启动交互式会话，使用 -p/--print 进行非交互式输出"),
    
    ("Your prompt", "您的提示"),
    
    ("Display help for command", "显示命令帮助"),
    
    # Debug 选项
    ("Enable debug mode with optional category filtering (e.g., \"api,hooks\" or \"!1p,!file\")",
     "启用调试模式，可选择类别过滤（例如 \"api,hooks\" 或 \"!1p,!file\"）"),
    ("Enable debug mode (to stderr)", "启用调试模式（输出到 stderr）"),
    ("Write debug logs to a specific file path (implicitly enables debug mode)",
     "将调试日志写入指定文件路径（隐式启用调试模式）"),
    ("Override verbose mode setting from config", "覆盖配置中的详细模式设置"),
    
    # Print 选项
    ("Print response and exit (useful for pipes). Note: The workspace trust dialog is skipped when Claude is run with the -p mode. Only use this flag in directories you trust.",
     "打印响应并退出（适用于管道）。注意：使用 -p 模式运行 Claude 时会跳过工作区信任对话框。仅在你信任的目录中使用此标志。"),
    
    # Bare 模式
    ("Minimal mode: skip hooks, LSP, plugin sync, attribution, auto-memory, background prefetches, keychain reads, and CLAUDE.md auto-discovery. Sets CLAUDE_CODE_SIMPLE=1. Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (OAuth and keychain are never read). 3P providers (Bedrock/Vertex/Foundry) use their own credentials. Skills still resolve via /skill-name. Explicitly provide context via: --system-prompt[-file], --append-system-prompt[-file], --add-dir (CLAUDE.md dirs), --mcp-config, --settings, --agents, --plugin-dir.",
     "极简模式：跳过钩子、LSP、插件同步、归因、自动记忆、后台预取、钥匙串读取和 CLAUDE.md 自动发现。设置 CLAUDE_CODE_SIMPLE=1。Anthropic 认证严格使用 ANTHROPIC_API_KEY 或通过 --settings 的 apiKeyHelper（从不读取 OAuth 和钥匙串）。第三方提供商（Bedrock/Vertex/Foundry）使用自己的凭据。技能仍通过 /skill-name 解析。通过以下方式显式提供上下文：--system-prompt[-file]、--append-system-prompt[-file]、--add-dir（CLAUDE.md 目录）、--mcp-config、--settings、--agents、--plugin-dir。"),
    
    # Init 选项
    ("Run Setup hooks with init trigger, then continue", "使用 init 触发器运行设置钩子，然后继续"),
    ("Run Setup and SessionStart:startup hooks, then exit", "运行设置和 SessionStart:startup 钩子，然后退出"),
    ("Run Setup hooks with maintenance trigger, then continue", "使用维护触发器运行设置钩子，然后继续"),
    
    # 输出格式
    ("Output format (only works with --print): \"text\" (default), \"json\" (single result), or \"stream-json\" (realtime streaming)",
     "输出格式（仅适用于 --print）：\"text\"（默认）、\"json\"（单个结果）或 \"stream-json\"（实时流式传输）"),
    
    # JSON Schema
    ("JSON Schema for structured output validation. ", "用于结构化输出验证的 JSON Schema。"),
    ("Example: {\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"}},\"required\":[\"name\"]}",
     "示例：{\"type\":\"object\",\"properties\":{\"name\":{\"type\":\"string\"}},\"required\":[\"name\"]}"),
    
    # 钩子事件
    ("Include all hook lifecycle events in the output stream (only works with --output-format=stream-json)",
     "在输出流中包含所有钩子生命周期事件（仅适用于 --output-format=stream-json）"),
    
    # 部分消息
    ("Include partial message chunks as they arrive (only works with --print and --output-format=stream-json)",
     "在部分消息块到达时包含它们（仅适用于 --print 和 --output-format=stream-json）"),
    
    # 输入格式
    ("Input format (only works with --print): \"text\" (default), or \"stream-json\" (realtime streaming input)",
     "输入格式（仅适用于 --print）：\"text\"（默认）或 \"stream-json\"（实时流式输入）"),
    
    # MCP 调试
    ("[DEPRECATED. Use --debug instead] Enable MCP debug mode (shows MCP server errors)",
     "[已废弃。请改用 --debug] 启用 MCP 调试模式（显示 MCP 服务器错误）"),
    
    # 权限选项
    ("Bypass all permission checks. Recommended only for sandboxes with no internet access.",
     "绕过所有权限检查。仅建议在没有互联网访问的沙箱中使用。"),
    ("Enable bypassing all permission checks as an option, without it being enabled by default. Recommended only for sandboxes with no internet access.",
     "启用绕过所有权限检查作为选项，但默认不启用。仅建议在没有互联网访问的沙箱中使用。"),
    
    # 思考模式
    ("Thinking mode: enabled (equivalent to adaptive), disabled", "思考模式：enabled（等同于 adaptive）、disabled"),
    
    # 最大思考令牌
    ("[DEPRECATED. Use --thinking instead for newer models] Maximum number of thinking tokens (only works with --print)",
     "[已废弃。对于较新的模型，请改用 --thinking] 最大思考令牌数（仅适用于 --print）"),
    
    # 最大轮次
    ("Maximum number of agentic turns in non-interactive mode. This will early exit the conversation after the specified number of turns. (only works with --print)",
     "非交互模式下的最大代理轮次。这将在指定轮次后提前退出对话。（仅适用于 --print）"),
    
    # 最大预算
    ("Maximum dollar amount to spend on API calls (only works with --print)",
     "可用于 API 调用的最大金额（仅适用于 --print）"),
    ("--max-budget-usd must be a positive number greater than 0",
     "--max-budget-usd 必须是大于 0 的正数"),
    
    # 任务预算
    ("API-side task budget in tokens (output_config.task_budget)",
     "API 端任务预算（以令牌为单位）(output_config.task_budget)"),
    ("--task-budget must be a positive integer",
     "--task-budget 必须是正整数"),
    
    # 重放用户消息
    ("Re-emit user messages from stdin back on stdout for acknowledgment (only works with --input-format=stream-json and --output-format=stream-json)",
     "将 stdin 的用户消息重新发送到 stdout 以进行确认（仅适用于 --input-format=stream-json 和 --output-format=stream-json）"),
    
    # 认证状态
    ("Enable auth status messages in SDK mode", "在 SDK 模式下启用认证状态消息"),
    
    # 工具选项
    ("Comma or space-separated list of tool names to allow (e.g. \"Bash(git:*) Edit\")",
     "逗号或空格分隔的允许工具名称列表（例如 \"Bash(git:*) Edit\"）"),
    ("Specify the list of available tools from the built-in set. Use \"\" to disable all tools, \"default\" to use all tools, or specify tool names (e.g. \"Bash,Edit,Read\").",
     "从内置集合中指定可用工具列表。使用 \"\" 禁用所有工具，使用 \"default\" 使用所有工具，或指定工具名称（例如 \"Bash,Edit,Read\"）。"),
    ("Comma or space-separated list of tool names to deny (e.g. \"Bash(git:*) Edit\")",
     "逗号或空格分隔的拒绝工具名称列表（例如 \"Bash(git:*) Edit\"）"),
    
    # MCP 配置
    ("Load MCP servers from JSON files or strings (space-separated)",
     "从 JSON 文件或字符串加载 MCP 服务器（空格分隔）"),
    
    # 权限提示工具
    ("MCP tool to use for permission prompts (only works with --print)",
     "用于权限提示的 MCP 工具（仅适用于 --print）"),
    
    # 系统提示
    ("System prompt to use for the session", "会话使用的系统提示"),
    ("Read system prompt from a file", "从文件读取系统提示"),
    ("Append a system prompt to the default system prompt", "向默认系统提示追加系统提示"),
    ("Read system prompt from a file and append to the default system prompt",
     "从文件读取系统提示并追加到默认系统提示"),
    
    # 权限模式
    ("Permission mode to use for the session", "会话使用的权限模式"),
    
    # 继续/恢复选项
    ("Continue the most recent conversation in the current directory",
     "继续当前目录中最近的对话"),
    ("Resume a conversation by session ID, or open interactive picker with optional search term",
     "按会话 ID 恢复对话，或打开带有可选搜索词的交互式选择器"),
    ("When resuming, create a new session ID instead of reusing the original (use with --resume or --continue)",
     "恢复时，创建新的会话 ID 而不是重用原始 ID（与 --resume 或 --continue 一起使用）"),
    
    # 预填充
    ("Pre-fill the prompt input with text without submitting it",
     "用文本预填充提示输入而不提交"),
    
    # 深度链接选项
    ("Signal that this session was launched from a deep link",
     "指示此会话是从深度链接启动的"),
    ("Repo slug the deep link ?repo= parameter resolved to the current cwd",
     "深度链接 ?repo= 参数解析为当前工作目录的仓库 slug"),
    ("FETCH_HEAD mtime in epoch ms, precomputed by the deep link trampoline",
     "FETCH_HEAD 的修改时间（以纪元毫秒为单位），由深度链接跳板预计算"),
    
    # 从 PR 恢复
    ("Resume a session linked to a PR by PR number/URL, or open interactive picker with optional search term",
     "按 PR 编号/URL 恢复链接到 PR 的会话，或打开带有可选搜索词的交互式选择器"),
    
    # 会话持久化
    ("Disable session persistence - sessions will not be saved to disk and cannot be resumed (only works with --print)",
     "禁用会话持久化 - 会话不会保存到磁盘且无法恢复（仅适用于 --print）"),
    
    # 恢复会话位置
    ("When resuming, only messages up to and including the assistant message with <message.id> (use with --resume in print mode)",
     "恢复时，仅包含截止到并包含具有 <message.id> 的助手消息的消息（在打印模式下与 --resume 一起使用）"),
    
    # 回退文件
    ("Restore files to state at the specified user message and exit (requires --resume)",
     "将文件恢复到指定用户消息时的状态并退出（需要 --resume）"),
    
    # 模型选项
    ("Model for the current session. Provide an alias for the latest model (e.g. 'sonnet' or 'opus') or a model's full name (e.g. 'claude-sonnet-4-6').",
     "当前会话的模型。提供最新模型的别名（例如 'sonnet' 或 'opus'）或模型的全名（例如 'claude-sonnet-4-6'）。"),
    
    # 努力级别
    ("Effort level for the current session (low, medium, high, max)",
     "当前会话的努力级别（低、中、高、最高）"),
    ("It must be one of: ", "必须是以下之一："),
    
    # 代理选项
    ("Agent for the current session. Overrides the 'agent' setting.",
     "当前会话的代理。覆盖 'agent' 设置。"),
    
    # Beta 标头
    ("Beta headers to include in API requests (API key users only)",
     "要包含在 API 请求中的 Beta 标头（仅限 API 密钥用户）"),
    
    # 回退模型
    ("Enable automatic fallback to specified model when default model is overloaded (only works with --print)",
     "当默认模型过载时启用自动回退到指定模型（仅适用于 --print）"),
    
    # 工作负载标签
    ("Workload tag for billing-header attribution (cc_workload). Process-scoped; set by SDK daemon callers that spawn subprocesses for cron work. (only works with --print)",
     "用于计费标头归因的工作负载标签 (cc_workload)。进程范围；由为 cron 工作生成子进程的 SDK 守护程序调用者设置。（仅适用于 --print）"),
    
    # 设置
    ("Path to a settings JSON file or a JSON string to load additional settings from",
     "设置 JSON 文件的路径或要从中加载附加设置的 JSON 字符串"),
    
    # 添加目录
    ("Additional directories to allow tool access to", "允许工具访问的附加目录"),
    
    # IDE
    ("Automatically connect to IDE on startup if exactly one valid IDE is available",
     "如果只有一个有效的 IDE 可用，则在启动时自动连接到 IDE"),
    
    # 严格 MCP 配置
    ("Only use MCP servers from --mcp-config, ignoring all other MCP configurations",
     "仅使用来自 --mcp-config 的 MCP 服务器，忽略所有其他 MCP 配置"),
    
    # 会话 ID
    ("Use a specific session ID for the conversation (must be a valid UUID)",
     "为对话使用特定的会话 ID（必须是有效的 UUID）"),
    
    # 名称
    ("Set a display name for this session (shown in /resume and terminal title)",
     "设置此会话的显示名称（显示在 /resume 和终端标题中）"),
    
    # 代理 JSON
    ("JSON object defining custom agents (e.g. '{\"reviewer\": {\"description\": \"Reviews code\", \"prompt\": \"You are a code reviewer\"}}')",
     "定义自定义代理的 JSON 对象（例如 '{\"reviewer\": {\"description\": \"Reviews code\", \"prompt\": \"You are a code reviewer\"}}'）"),
    
    # 设置源
    ("Comma-separated list of setting sources to load (user, project, local).",
     "要加载的设置源的逗号分隔列表（user、project、local）。"),
    
    # 插件目录
    ("Load plugins from a directory for this session only (repeatable: --plugin-dir A --plugin-dir B)",
     "仅为此会话从目录加载插件（可重复：--plugin-dir A --plugin-dir B）"),
    
    # 禁用斜杠命令
    ("Disable all skills", "禁用所有技能"),
    
    # Chrome 集成
    ("Enable Claude in Chrome integration", "启用 Claude in Chrome 集成"),
    ("Disable Claude in Chrome integration", "禁用 Claude in Chrome 集成"),
    
    # 文件资源
    ("File resources to download at startup. Format: file_id:relative_path (e.g., --file file_abc:doc.txt file_def:img.png)",
     "启动时下载的文件资源。格式：file_id:relative_path（例如，--file file_abc:doc.txt file_def:img.png）"),
    
    # 提示消息
    ("Tip: You can launch Claude Code with just `claude`",
     "提示: 你可以直接使用 `claude` 启动 Claude Code"),
    
    # 助手模式已禁用
    ("Assistant mode disabled: directory is not trusted. Accept the trust dialog and restart.",
     "助手模式已禁用：目录不受信任。接受信任对话框后重新启动。"),
    
    # 版本选项
    ("Output the version number", "输出版本号"),
    
    # ========== 工作树和 tmux 选项 ==========
    ("Create a new git worktree for this session (optionally specify a name)",
     "为此会话创建新的 git 工作树（可选择指定名称）"),
    ("Create a tmux session for the worktree (requires --worktree). Uses iTerm2 native panes when available; use --tmux=classic for traditional tmux.",
     "为工作树创建 tmux 会话（需要 --worktree）。可用时使用 iTerm2 原生窗格；使用 --tmux=classic 获得传统 tmux。"),
    
    # 顾问选项
    ("Enable the server-side advisor tool with the specified model (alias or full ID).",
     "使用指定模型启用服务器端顾问工具（别名或完整 ID）。"),
    
    # ANT-ONLY 选项
    ("[ANT-ONLY] Alias for --permission-mode auto.",
     "[仅限 ANT] --permission-mode auto 的别名。"),
    ("[ANT-ONLY] Deprecated alias for --permission-mode auto.",
     "[仅限 ANT] --permission-mode auto 的已废弃别名。"),
    ("[ANT-ONLY] Tasks mode: watch for tasks and auto-process them. Optional id is used as both the task list ID and agent ID (defaults to \"tasklist\").",
     "[仅限 ANT] 任务模式：监视任务并自动处理它们。可选的 id 同时用作任务列表 ID 和代理 ID（默认为 \"tasklist\"）。"),
    ("[ANT-ONLY] Force Claude to use multi-agent mode for solving problems",
     "[仅限 ANT] 强制 Claude 使用多代理模式解决问题"),
    
    # 自动模式
    ("Opt in to auto mode", "选择加入自动模式"),
    
    # 主动模式
    ("Start in proactive autonomous mode", "以主动自主模式启动"),
    
    # 消息套接字路径
    ("Unix domain socket path for the UDS messaging server (defaults to a tmp path)",
     "UDS 消息服务器的 Unix 域套接字路径（默认为 tmp 路径）"),
    
    # Brief 工具
    ("Enable SendUserMessage tool for agent-to-user communication",
     "启用 SendUserMessage 工具用于代理到用户的通信"),
    
    # 助手模式
    ("Force assistant mode (Agent SDK daemon use)", "强制助手模式（用于 Agent SDK 守护程序）"),
    
    # 频道
    ("MCP servers whose channel notifications (inbound push) should register this session. Space-separated server names.",
     "其频道通知（入站推送）应注册此会话的 MCP 服务器。空格分隔的服务器名称。"),
    
    # 开发频道
    ("Load channel servers not on the approved allowlist. For local channel development only. Shows a confirmation dialog at startup.",
     "加载不在批准白名单上的频道服务器。仅用于本地频道开发。启动时显示确认对话框。"),
    
    # 队友选项
    ("Teammate agent ID", "队友代理 ID"),
    ("Teammate display name", "队友显示名称"),
    ("Team name for swarm coordination", "集群协调的团队名称"),
    ("Teammate UI color", "队友 UI 颜色"),
    ("Require plan mode before implementation", "实施前需要计划模式"),
    ("Parent session ID for analytics correlation", "用于分析关联的父会话 ID"),
    ("How to spawn teammates: \"tmux\", \"in-process\", or \"auto\"",
     "如何生成队友：\"tmux\"、\"in-process\" 或 \"auto\""),
    ("Custom agent type for this teammate", "此队友的自定义代理类型"),
    
    # SDK URL
    ("Use remote WebSocket endpoint for SDK I/O streaming (only with -p and stream-json format)",
     "使用远程 WebSocket 端点进行 SDK I/O 流式传输（仅适用于 -p 和 stream-json 格式）"),
    
    # 传送
    ("Resume a teleport session, optionally specify session ID",
     "恢复传送会话，可选择指定会话 ID"),
    
    # 远程
    ("Create a remote session with the given description",
     "使用给定描述创建远程会话"),
    
    # 远程控制
    ("Start an interactive session with Remote Control enabled (optionally named)",
     "启动启用远程控制的交互式会话（可选择命名）"),
    ("Alias for --remote-control", "--remote-control 的别名"),
    
    # 硬失败
    ("Crash on logError calls instead of silently logging",
     "在 logError 调用时崩溃而不是静默记录"),
    
    # ========== 错误消息 ==========
    ("Error: Invalid JSON provided to --settings",
     "错误: 向 --settings 提供了无效的 JSON"),
    ("Error: Settings file not found: ",
     "错误: 找不到设置文件: "),
    ("Error processing settings: ",
     "处理设置时出错: "),
    ("Error processing --setting-sources: ",
     "处理 --setting-sources 时出错: "),
    ("Error: headless (-p/--print) mode is not supported with claude ssh",
     "错误: claude ssh 不支持无头模式（-p/--print）"),
    ("Error: --tmux requires --worktree",
     "错误: --tmux 需要 --worktree"),
    ("Error: --tmux is not supported on Windows",
     "错误: Windows 不支持 --tmux"),
    ("Error: tmux is not installed.",
     "错误: tmux 未安装。"),
    ("Error: --agent-id, --agent-name, and --team-name must all be provided together",
     "错误: --agent-id、--agent-name 和 --team-name 必须一起提供"),
    ("Error: --session-id can only be used with --continue or --resume if --fork-session is also specified.",
     "错误: --session-id 只能与 --continue 或 --resume 一起使用，并且还必须指定 --fork-session。"),
    ("Error: Invalid session ID. Must be a valid UUID.",
     "错误: 无效的会话 ID。必须是有效的 UUID。"),
    ("Error: Session ID ${validatedSessionId} is already in use.",
     "错误: 会话 ID ${validatedSessionId} 已在使用中。"),
    ("Error: Session token required for file downloads. CLAUDE_CODE_SESSION_ACCESS_TOKEN must be set.",
     "错误: 文件下载需要会话令牌。必须设置 CLAUDE_CODE_SESSION_ACCESS_TOKEN。"),
    ("Error: Fallback model cannot be the same as the main model. Please specify a different model for --fallback-model.",
     "错误: 回退模型不能与主模型相同。请为 --fallback-model 指定不同的模型。"),
    ("Error: Cannot use both --system-prompt and --system-prompt-file. Please use only one.",
     "错误: 不能同时使用 --system-prompt 和 --system-prompt-file。请只使用一个。"),
    ("Error: System prompt file not found: ",
     "错误: 找不到系统提示文件: "),
    ("Error reading system prompt file: ",
     "读取系统提示文件时出错: "),
    ("Error: Cannot use both --append-system-prompt and --append-system-prompt-file. Please use only one.",
     "错误: 不能同时使用 --append-system-prompt 和 --append-system-prompt-file。请只使用一个。"),
    ("Error: Append system prompt file not found: ",
     "错误: 找不到追加系统提示文件: "),
    ("Error reading append system prompt file: ",
     "读取追加系统提示文件时出错: "),
    ("Error: Invalid MCP configuration:",
     "错误: MCP 配置无效:"),
    ("Invalid MCP configuration: \"",
     "MCP 配置无效: \""),
    ("\" is a reserved MCP name.",
     "\" 是保留的 MCP 名称。"),
    ("Error: Failed to run with Claude in Chrome.",
     "错误: 使用 Claude in Chrome 运行失败。"),
    ("Error: Invalid input format \"${inputFormat}\".",
     "错误: 输入格式 \"${inputFormat}\" 无效。"),
    ("Error: --input-format=stream-json requires output-format=stream-json.",
     "错误: --input-format=stream-json 需要 output-format=stream-json。"),
    ("Error: --sdk-url requires both --input-format=stream-json and --output-format=stream-json.",
     "错误: --sdk-url 需要 --input-format=stream-json 和 --output-format=stream-json。"),
    ("Error: --replay-user-messages requires both --input-format=stream-json and --output-format=stream-json.",
     "错误: --replay-user-messages 需要 --input-format=stream-json 和 --output-format=stream-json。"),
    ("Error: --include-partial-messages requires --print and --output-format=stream-json.",
     "错误: --include-partial-messages 需要 --print 和 --output-format=stream-json。"),
    ("Error: --no-session-persistence can only be used with --print mode.",
     "错误: --no-session-persistence 只能与 --print 模式一起使用。"),
    ("Error: The model \"${resolvedInitialModel}\" does not support the advisor tool.",
     "错误: 模型 \"${resolvedInitialModel}\" 不支持顾问工具。"),
    ("Error: The model \"${advisorOption}\" cannot be used as an advisor.",
     "错误: 模型 \"${advisorOption}\" 不能用作顾问。"),
    
    # ========== 警告消息 ==========
    ("Warning: no stdin data received in 3s, proceeding without it. " + 
     "If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.",
     "警告: 3秒内未收到 stdin 数据，继续进行。" +
     "如果从慢速命令管道输入，请显式重定向 stdin：使用 < /dev/null 跳过，或等待更长时间。"),
    ("Warning: MCP ${plural(blocked.length, 'server')} blocked by enterprise policy: ${blocked.join(', ')}",
     "警告: MCP ${plural(blocked.length, '服务器')} 被企业策略阻止: ${blocked.join(', ')}"),
    ("Warning: claude.ai MCP ${plural(blocked.length, 'server')} blocked by enterprise policy: ${blocked.join(', ')}",
     "警告: claude.ai MCP ${plural(blocked.length, '服务器')} 被企业策略阻止: ${blocked.join(', ')}"),
    ("Warning: ${failedCount}/${results.length} file(s) failed to download.",
     "警告: ${failedCount}/${results.length} 个文件下载失败。"),
    ("--rc flag ignored.",
     "--rc 标志已忽略。"),
    
    # ========== MCP 命令 ==========
    ("Configure and manage MCP servers", "配置和管理 MCP 服务器"),
    ("Start the Claude Code MCP server", "启动 Claude Code MCP 服务器"),
    ("Enable debug mode", "启用调试模式"),
    ("Remove an MCP server", "移除 MCP 服务器"),
    ("Configuration scope (local, user, or project) - if not specified, removes from whichever scope it exists in",
     "配置范围（local、user 或 project）- 如果未指定，则从其存在的任何范围中移除"),
    ("List configured MCP servers. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.",
     "列出已配置的 MCP 服务器。注意：跳过工作区信任对话框，并从 .mcp.json 生成 stdio 服务器以进行健康检查。仅在你信任的目录中使用此命令。"),
    ("Get details about an MCP server. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.",
     "获取有关 MCP 服务器的详细信息。注意：跳过工作区信任对话框，并从 .mcp.json 生成 stdio 服务器以进行健康检查。仅在你信任的目录中使用此命令。"),
    ("Add an MCP server (stdio or SSE) with a JSON string",
     "使用 JSON 字符串添加 MCP 服务器（stdio 或 SSE）"),
    ("Configuration scope (local, user, or project)", "配置范围（local、user 或 project）"),
    ("Prompt for OAuth client secret (or set MCP_CLIENT_SECRET env var)",
     "提示输入 OAuth 客户端密钥（或设置 MCP_CLIENT_SECRET 环境变量）"),
    ("Import MCP servers from Claude Desktop (Mac and WSL only)",
     "从 Claude Desktop 导入 MCP 服务器（仅限 Mac 和 WSL）"),
    ("Reset all approved and rejected project-scoped (.mcp.json) servers within this project",
     "重置此项目中所有已批准和已拒绝的项目范围（.mcp.json）服务器"),
    
    # ========== Server 命令 ==========
    ("Start a Claude Code session server", "启动 Claude Code 会话服务器"),
    ("HTTP port", "HTTP 端口"),
    ("Bind address", "绑定地址"),
    ("Bearer token for auth", "认证的 Bearer 令牌"),
    ("Listen on a unix domain socket", "在 unix 域套接字上监听"),
    ("Default working directory for sessions that do not specify cwd",
     "未指定 cwd 的会话的默认工作目录"),
    ("Idle timeout for detached sessions in ms (0 = never expire)",
     "分离会话的空闲超时（以毫秒为单位）（0 = 永不过期）"),
    ("Maximum concurrent sessions (0 = unlimited)", "最大并发会话数（0 = 无限制）"),
    
    # ========== SSH 命令 ==========
    ("Run Claude Code on a remote host over SSH. Deploys the binary and " + 
     "tunnels API auth back through your local machine — no remote setup needed.",
     "通过 SSH 在远程主机上运行 Claude Code。部署二进制文件并" +
     "将 API 认证通过本地机器隧道传回 — 无需远程设置。"),
    ("Permission mode for the remote session", "远程会话的权限模式"),
    ("Skip all permission prompts on the remote (dangerous)",
     "跳过远程上的所有权限提示（危险）"),
    ("e2e test mode — spawn the child CLI locally (skip ssh/deploy). " +
     "Exercises the auth proxy and unix-socket plumbing without a remote host.",
     "e2e 测试模式 — 在本地生成子 CLI（跳过 ssh/deploy）。" +
     "在没有远程主机的情况下测试认证代理和 unix-socket 管道。"),
    
    # ========== Open 命令 ==========
    ("Connect to a Claude Code server (internal — use cc:// URLs)",
     "连接到 Claude Code 服务器（内部 — 使用 cc:// URL）"),
    ("Print mode (headless)", "打印模式（无头）"),
    ("Output format: text, json, stream-json", "输出格式：text、json、stream-json"),
    
    # ========== Auth 命令 ==========
    ("Manage authentication", "管理认证"),
    ("Sign in to your Anthropic account", "登录你的 Anthropic 账户"),
    ("Pre-populate email address on the login page", "在登录页面预填充电子邮件地址"),
    ("Force SSO login flow", "强制 SSO 登录流程"),
    ("Use Anthropic Console (API usage billing) instead of Claude subscription",
     "使用 Anthropic 控制台（API 使用计费）而不是 Claude 订阅"),
    ("Use Claude subscription (default)", "使用 Claude 订阅（默认）"),
    ("Show authentication status", "显示认证状态"),
    ("Output as JSON (default)", "输出为 JSON（默认）"),
    ("Output as human-readable text", "输出为人类可读的文本"),
    ("Log out from your Anthropic account", "退出你的 Anthropic 账户"),
    
    # ========== Plugin 命令 ==========
    ("Manage Claude Code plugins", "管理 Claude Code 插件"),
    ("Validate a plugin or marketplace manifest", "验证插件或市场清单"),
    ("List installed plugins", "列出已安装的插件"),
    ("Output as JSON", "输出为 JSON"),
    ("Include available plugins from marketplaces (requires --json)",
     "包括来自市场的可用插件（需要 --json）"),
    
    # ========== Marketplace 命令 ==========
    ("Manage Claude Code marketplaces", "管理 Claude Code 市场"),
    ("Add a marketplace from a URL, path, or GitHub repo",
     "从 URL、路径或 GitHub 仓库添加市场"),
    ("Limit checkout to specific directories via git sparse-checkout (for monorepos). Example: --sparse .claude-plugin plugins",
     "通过 git sparse-checkout 将检出限制到特定目录（用于 monorepo）。示例：--sparse .claude-plugin plugins"),
    ("Where to declare the marketplace: user (default), project, or local",
     "在哪里声明市场：user（默认）、project 或 local"),
    ("List all configured marketplaces", "列出所有已配置的市场"),
    ("Remove a configured marketplace", "移除已配置的市场"),
    ("Update marketplace(s) from their source - updates all if no name specified",
     "从其源更新市场 - 如果未指定名称则更新所有"),
    
    # ========== Plugin install/uninstall/enable/disable/update ==========
    ("Install a plugin from available marketplaces (use plugin@marketplace for specific marketplace)",
     "从可用市场安装插件（使用 plugin@marketplace 指定特定市场）"),
    ("Installation scope: user, project, or local", "安装范围：user、project 或 local"),
    ("Uninstall an installed plugin", "卸载已安装的插件"),
    ("Uninstall from scope: user, project, or local", "从范围卸载：user、project 或 local"),
    ("Preserve the plugin's persistent data directory (~/.claude/plugins/data/{id}/)",
     "保留插件的持久数据目录（~/.claude/plugins/data/{id}/）"),
    ("Enable a disabled plugin", "启用已禁用的插件"),
    ("Installation scope: ${VALID_INSTALLABLE_SCOPES.join(', ')} (default: auto-detect)",
     "安装范围：${VALID_INSTALLABLE_SCOPES.join(', ')}（默认：自动检测）"),
    ("Disable an enabled plugin", "禁用已启用的插件"),
    ("Disable all enabled plugins", "禁用所有已启用的插件"),
    ("Update a plugin to the latest version (restart required to apply)",
     "将插件更新到最新版本（需要重启才能生效）"),
    ("Installation scope: ${VALID_UPDATE_SCOPES.join(', ')} (default: user)",
     "安装范围：${VALID_UPDATE_SCOPES.join(', ')}（默认：user）"),
    
    # ========== Setup token ==========
    ("Set up a long-lived authentication token (requires Claude subscription)",
     "设置长期认证令牌（需要 Claude 订阅）"),
    
    # ========== Agents 命令 ==========
    ("List configured agents", "列出已配置的代理"),
    
    # ========== Auto mode 命令 ==========
    ("Inspect auto mode classifier configuration", "检查自动模式分类器配置"),
    ("Print the default auto mode environment, allow, and deny rules as JSON",
     "以 JSON 格式打印默认的自动模式环境、允许和拒绝规则"),
    ("Print the effective auto mode config as JSON: your settings where set, defaults otherwise",
     "以 JSON 格式打印有效的自动模式配置：你的设置（如果已设置），否则为默认值"),
    ("Get AI feedback on your custom auto mode rules",
     "获取有关你的自定义自动模式规则的 AI 反馈"),
    ("Override which model is used", "覆盖使用的模型"),
    
    # ========== Assistant 命令 ==========
    ("Attach the REPL as a client to a running bridge session. Discovers sessions via API if no sessionId given.",
     "将 REPL 作为客户端附加到正在运行的桥接会话。如果未给出 sessionId，则通过 API 发现会话。"),
    
    # ========== Doctor 命令 ==========
    ("Check the health of your Claude Code auto-updater. Note: The workspace trust dialog is skipped and stdio servers from .mcp.json are spawned for health checks. Only use this command in directories you trust.",
     "检查你的 Claude Code 自动更新程序的运行状况。注意：跳过工作区信任对话框，并从 .mcp.json 生成 stdio 服务器以进行健康检查。仅在你信任的目录中使用此命令。"),
    
    # ========== Update 命令 ==========
    ("Check for updates and install if available", "检查更新并在可用时安装"),
    
    # ========== Up 命令 ==========
    ("[ANT-ONLY] Initialize or upgrade the local dev environment using the \"# claude up\" section of the nearest CLAUDE.md",
     "[仅限 ANT] 使用最近的 CLAUDE.md 的 \"# claude up\" 部分初始化或升级本地开发环境"),
    
    # ========== Rollback 命令 ==========
    ("[ANT-ONLY] Roll back to a previous release\n\nExamples:\n  claude rollback                                    Go 1 version back from current\n  claude rollback 3                                  Go 3 versions back from current\n  claude rollback 2.0.73-dev.20251217.t190658        Roll back to a specific version",
     "[仅限 ANT] 回滚到以前的版本\n\n示例：\n  claude rollback                                    从当前版本回退 1 个版本\n  claude rollback 3                                  从当前版本回退 3 个版本\n  claude rollback 2.0.73-dev.20251217.t190658        回滚到特定版本"),
    ("List recent published versions with ages", "列出最近发布的版本及其使用年限"),
    ("Show what would be installed without installing", "显示将安装的内容而不实际安装"),
    ("Roll back to the server-pinned safe version (set by oncall during incidents)",
     "回滚到服务器固定的安全版本（由值班人员在事件期间设置）"),
    
    # ========== Install 命令 ==========
    ("Install Claude Code native build. Use [target] to specify version (stable, latest, or specific version)",
     "安装 Claude Code 原生构建。使用 [target] 指定版本（stable、latest 或特定版本）"),
    ("Force installation even if already installed", "即使已安装也强制安装"),
    
    # ========== Log 命令 ==========
    ("[ANT-ONLY] Manage conversation logs.", "[仅限 ANT] 管理对话日志。"),
    ("A number (0, 1, 2, etc.) to display a specific log, or the sesssion ID (uuid) of a log",
     "用于显示特定日志的数字（0、1、2 等），或日志的会话 ID（uuid）"),
    
    # ========== Error 命令 ==========
    ("[ANT-ONLY] View error logs. Optionally provide a number (0, -1, -2, etc.) to display a specific log.",
     "[仅限 ANT] 查看错误日志。可选择提供一个数字（0、-1、-2 等）以显示特定日志。"),
    ("A number (0, 1, 2, etc.) to display a specific log",
     "用于显示特定日志的数字（0、1、2 等）"),
    
    # ========== Export 命令 ==========
    ("[ANT-ONLY] Export a conversation to a text file.",
     "[仅限 ANT] 将对话导出到文本文件。"),
    ("Session ID, log index (0, 1, 2...), or path to a .json/.jsonl log file",
     "会话 ID、日志索引（0、1、2...）或 .json/.jsonl 日志文件的路径"),
    ("Output file path for the exported text", "导出文本的输出文件路径"),
    ("Examples:", "示例："),
    ("  $ claude export 0 conversation.txt                Export conversation at log index 0",
     "  $ claude export 0 conversation.txt                导出日志索引 0 处的对话"),
    ("  $ claude export <uuid> conversation.txt           Export conversation by session ID",
     "  $ claude export <uuid> conversation.txt           按会话 ID 导出对话"),
    ("  $ claude export input.json output.txt             Render JSON log file to text",
     "  $ claude export input.json output.txt             将 JSON 日志文件渲染为文本"),
    ("  $ claude export <uuid>.jsonl output.txt           Render JSONL session file to text",
     "  $ claude export <uuid>.jsonl output.txt           将 JSONL 会话文件渲染为文本"),
    
    # ========== Task 命令 ==========
    ("[ANT-ONLY] Manage task list tasks", "[仅限 ANT] 管理任务列表任务"),
    ("Create a new task", "创建新任务"),
    ("Task description", "任务描述"),
    ("Task list ID (defaults to \"tasklist\")", "任务列表 ID（默认为 \"tasklist\"）"),
    ("List all tasks", "列出所有任务"),
    ("Show only pending tasks", "仅显示待处理任务"),
    ("Get details of a task", "获取任务详情"),
    ("Update a task", "更新任务"),
    ("Set status (${TASK_STATUSES.join(', ')})",
     "设置状态（${TASK_STATUSES.join(', ')}）"),
    ("Update subject", "更新主题"),
    ("Update description", "更新描述"),
    ("Set owner", "设置所有者"),
    ("Clear owner", "清除所有者"),
    ("Show the tasks directory path", "显示任务目录路径"),
    
    # ========== Completion 命令 ==========
    ("Generate shell completion script (bash, zsh, or fish)",
     "生成 shell 补全脚本（bash、zsh 或 fish）"),
    ("Write completion script directly to a file instead of stdout",
     "将补全脚本直接写入文件而不是 stdout"),
    
    # ========== 企业 MCP 错误 ==========
    ("You cannot use --strict-mcp-config when an enterprise MCP config is present",
     "存在企业 MCP 配置时，不能使用 --strict-mcp-config"),
    ("You cannot dynamically configure MCP servers when an enterprise MCP config is present",
     "存在企业 MCP 配置时，不能动态配置 MCP 服务器"),
    
    # ========== 频道条目错误 ==========
    ("${flag} entries must be tagged: ${bad.join(', ')}\n" + 
     "  plugin:<name>@<marketplace>  — plugin-provided channel (allowlist enforced)\n" +
     "  server:<name>                — manually configured MCP server",
     "${flag} 条目必须标记: ${bad.join(', ')}\n" +
     "  plugin:<name>@<marketplace>  — 插件提供的频道（强制执行白名单）\n" +
     "  server:<name>                — 手动配置的 MCP 服务器"),
    
    # ========== SSH 相关消息 ==========
    ("Starting local ssh-proxy test session...", "正在启动本地 ssh-proxy 测试会话..."),
    ("Connecting to ${_pendingSSH.host}…", "正在连接到 ${_pendingSSH.host}…"),
    
    # ========== 服务器相关消息 ==========
    ("A claude server is already running (pid ${existing.pid}) at ${existing.httpUrl}",
     "claude 服务器已在运行（进程 ID ${existing.pid}），地址为 ${existing.httpUrl}"),
    
    # ========== 使用说明 ==========
    ("Usage: claude ssh <user@host | ssh-config-alias> [dir]\n\n" + 
     "Runs Claude Code on a remote Linux host. You don't need to install\n" + 
     "anything on the remote or run `claude auth login` there — the binary is\n" +
     "deployed over SSH and API auth tunnels back through your local machine.",
     "用法: claude ssh <user@host | ssh-config-alias> [dir]\n\n" +
     "在远程 Linux 主机上运行 Claude Code。你不需要在远程机器上安装任何东西，\n" +
     "也不需要在那里运行 `claude auth login` — 二进制文件通过 SSH 部署，\n" +
     "API 认证通过你的本地机器隧道传回。"),
    ("Usage: claude assistant [sessionId]\n\n" + 
     "Attach the REPL as a viewer client to a running bridge session.\n" +
     "Omit sessionId to discover and pick from available sessions.",
     "用法: claude assistant [sessionId]\n\n" +
     "将 REPL 作为查看器客户端附加到正在运行的桥接会话。\n" +
     "省略 sessionId 以发现并从可用会话中选择。"),
    
    # ========== 远程会话错误 ==========
    ("Failed to authenticate", "认证失败"),
    ("Remote sessions are disabled by your organization's policy.",
     "你的组织策略禁用了远程会话。"),
    ("--remote requires a description.\nUsage: claude --remote \"your task description\"",
     "--remote 需要描述。\n用法: claude --remote \"你的任务描述\""),
    ("Unable to create remote session", "无法创建远程会话"),
    ("Failed to validate session", "验证会话失败"),
]

# 按字符串长度从长到短排序，确保长字符串先匹配
translations.sort(key=lambda x: len(x[0]), reverse=True)

count = 0
for original, translated in translations:
    if original in content:
        content = content.replace(original, translated)
        count += 1
        if count <= 10 or count % 20 == 0:
            print(f"Translated ({count}): {original[:80]}...")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal translations applied: {count}")
