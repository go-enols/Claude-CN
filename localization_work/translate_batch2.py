#!/usr/bin/env python3
import re
import sys

source_file = '/workspace/localization_work/source_repo/src/main.tsx'
target_file = '/workspace/localization_work/target_repo/src/main.tsx'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

translations = [
    # Settings errors
    ("Error: Invalid JSON provided to --settings", "错误: 向 --settings 提供了无效的 JSON"),
    ("Error: Settings file not found: ", "错误: 找不到设置文件: "),
    ("Error processing settings: ", "处理设置时出错: "),
    ("Error processing --setting-sources: ", "处理 --setting-sources 时出错: "),
    
    # SSH error
    ("Error: headless (-p/--print) mode is not supported with claude ssh",
     "错误: claude ssh 不支持无头模式（-p/--print）"),
    
    # Stdin warning
    ("Warning: no stdin data received in 3s, proceeding without it. " + 
     "If piping from a slow command, redirect stdin explicitly: < /dev/null to skip, or wait longer.",
     "警告: 3秒内未收到 stdin 数据，继续进行。" +
     "如果从慢速命令管道输入，请显式重定向 stdin：使用 < /dev/null 跳过，或等待更长时间。"),
    
    # Tmux errors
    ("Error: --tmux requires --worktree", "错误: --tmux 需要 --worktree"),
    ("Error: --tmux is not supported on Windows", "错误: Windows 不支持 --tmux"),
    ("Error: tmux is not installed.", "错误: tmux 未安装。"),
    
    # Agent options error
    ("Error: --agent-id, --agent-name, and --team-name must all be provided together",
     "错误: --agent-id、--agent-name 和 --team-name 必须一起提供"),
    
    # Session ID errors
    ("Error: --session-id can only be used with --continue or --resume if --fork-session is also specified.",
     "错误: --session-id 只能与 --continue 或 --resume 一起使用，并且还必须指定 --fork-session。"),
    ("Error: Invalid session ID. Must be a valid UUID.",
     "错误: 无效的会话 ID。必须是有效的 UUID。"),
    ("Error: Session ID ", "错误: 会话 ID "),
    (" is already in use.", " 已在使用中。"),
    
    # File download error
    ("Error: Session token required for file downloads. CLAUDE_CODE_SESSION_ACCESS_TOKEN must be set.",
     "错误: 文件下载需要会话令牌。必须设置 CLAUDE_CODE_SESSION_ACCESS_TOKEN。"),
    
    # Fallback model error
    ("Error: Fallback model cannot be the same as the main model. Please specify a different model for --fallback-model.",
     "错误: 回退模型不能与主模型相同。请为 --fallback-model 指定不同的模型。"),
    
    # System prompt errors
    ("Error: Cannot use both --system-prompt and --system-prompt-file. Please use only one.",
     "错误: 不能同时使用 --system-prompt 和 --system-prompt-file。请只使用一个。"),
    ("Error: System prompt file not found: ", "错误: 找不到系统提示文件: "),
    ("Error reading system prompt file: ", "读取系统提示文件时出错: "),
    ("Error: Cannot use both --append-system-prompt and --append-system-prompt-file. Please use only one.",
     "错误: 不能同时使用 --append-system-prompt 和 --append-system-prompt-file。请只使用一个。"),
    ("Error: Append system prompt file not found: ", "错误: 找不到追加系统提示文件: "),
    ("Error reading append system prompt file: ", "读取追加系统提示文件时出错: "),
    
    # MCP config errors
    ("Error: Invalid MCP configuration:", "错误: MCP 配置无效:"),
    ("Error: ", "错误: "),
    
    # MCP blocked warnings
    ("Warning: MCP ", "警告: MCP "),
    (" blocked by enterprise policy: ", " 被企业策略阻止: "),
    ("Warning: claude.ai MCP ", "警告: claude.ai MCP "),
    
    # Enterprise MCP errors
    ("You cannot use --strict-mcp-config when an enterprise MCP config is present",
     "存在企业 MCP 配置时，不能使用 --strict-mcp-config"),
    ("You cannot dynamically configure MCP servers when an enterprise MCP config is present",
     "存在企业 MCP 配置时，不能动态配置 MCP 服务器"),
    
    # Channel entries error
    (" entries must be tagged: ", " 条目必须标记: "),
    ("  plugin:<name>@<marketplace>  — plugin-provided channel (allowlist enforced)",
     "  plugin:<name>@<marketplace>  — 插件提供的频道（强制执行白名单）"),
    ("  server:<name>                — manually configured MCP server",
     "  server:<name>                — 手动配置的 MCP 服务器"),
    
    # Include partial messages error
    ("Error: --include-partial-messages requires --print and --output-format=stream-json.",
     "错误: --include-partial-messages 需要 --print 和 --output-format=stream-json。"),
    
    # No session persistence error
    ("Error: --no-session-persistence can only be used with --print mode.",
     "错误: --no-session-persistence 只能与 --print 模式一起使用。"),
    
    # Advisor errors
    ("Error: The model \"", "错误: 模型 \""),
    ("\" does not support the advisor tool.", "\" 不支持顾问工具。"),
    ("\" cannot be used as an advisor.", "\" 不能用作顾问。"),
    
    # RC disabled reason
    ("--rc flag ignored.", "--rc 标志已忽略。"),
    
    # SSH proxy messages
    ("Starting local ssh-proxy test session...", "正在启动本地 ssh-proxy 测试会话..."),
    ("Connecting to ", "正在连接到 "),
    
    # Download warning
    ("Warning: ", "警告: "),
    (" file(s) failed to download.", " 个文件下载失败。"),
    
    # Server already running
    ("A claude server is already running (pid ", "claude 服务器已在运行（进程 ID "),
    (") at ", ")，地址为 "),
    
    # SSH usage
    ("Usage: claude ssh <user@host | ssh-config-alias> [dir]\n\n" + 
     "Runs Claude Code on a remote Linux host. You don't need to install\n" + 
     "anything on the remote or run `claude auth login` there — the binary is\n" +
     "deployed over SSH and API auth tunnels back through your local machine.",
     "用法: claude ssh <user@host | ssh-config-alias> [dir]\n\n" +
     "在远程 Linux 主机上运行 Claude Code。你不需要在远程机器上安装任何东西，\n" +
     "也不需要在那里运行 `claude auth login` — 二进制文件通过 SSH 部署，\n" +
     "API 认证通过你的本地机器隧道传回。"),
    
    # Assistant usage
    ("Usage: claude assistant [sessionId]\n\n" + 
     "Attach the REPL as a viewer client to a running bridge session.\n" +
     "Omit sessionId to discover and pick from available sessions.",
     "用法: claude assistant [sessionId]\n\n" +
     "将 REPL 作为查看器客户端附加到正在运行的桥接会话。\n" +
     "省略 sessionId 以发现并从可用会话中选择。"),
    
    # Version option
    ("Output the version number", "输出版本号"),
    
    # Completion command (let's check if it exists)
]

translations.sort(key=lambda x: len(x[0]), reverse=True)

count = 0
for original, translated in translations:
    if original in content:
        content = content.replace(original, translated)
        count += 1
        print(f"Translated ({count}): {original[:60]}...")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal translations applied in this batch: {count}")
