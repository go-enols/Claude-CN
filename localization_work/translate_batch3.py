#!/usr/bin/env python3
import re
import sys

source_file = '/workspace/localization_work/source_repo/src/main.tsx'
target_file = '/workspace/localization_work/target_repo/src/main.tsx'

with open(target_file, 'r', encoding='utf-8') as f:
    content = f.read()

translations = [
    # Export command examples
    ("Examples:", "示例："),
    ("  $ claude export 0 conversation.txt                Export conversation at log index 0",
     "  $ claude export 0 conversation.txt                导出日志索引 0 处的对话"),
    ("  $ claude export <uuid> conversation.txt           Export conversation by session ID",
     "  $ claude export <uuid> conversation.txt           按会话 ID 导出对话"),
    ("  $ claude export input.json output.txt             Render JSON log file to text",
     "  $ claude export input.json output.txt             将 JSON 日志文件渲染为文本"),
    ("  $ claude export <uuid>.jsonl output.txt           Render JSONL session file to text",
     "  $ claude export <uuid>.jsonl output.txt           将 JSONL 会话文件渲染为文本"),
    
    # Completion command
    ("Generate shell completion script (bash, zsh, or fish)",
     "生成 shell 补全脚本（bash、zsh 或 fish）"),
    ("Write completion script directly to a file instead of stdout",
     "将补全脚本直接写入文件而不是 stdout"),
    
    # Rollback command (check if we missed the multi-line description)
    ("Go 1 version back from current", "从当前版本回退 1 个版本"),
    ("Go 3 versions back from current", "从当前版本回退 3 个版本"),
    ("Roll back to a specific version", "回滚到特定版本"),
    
    # Let's also check for any other user-visible strings we might have missed
    # Check for common patterns
    ("server", "服务器"),
    ("servers", "服务器"),
]

translations.sort(key=lambda x: len(x[0]), reverse=True)

count = 0
for original, translated in translations:
    if original in content:
        # Be careful with short strings like "server" and "servers"
        # Only translate them in specific contexts (like user-facing messages)
        if original in ['server', 'servers']:
            # Skip these generic words to avoid breaking code
            continue
        content = content.replace(original, translated)
        count += 1
        print(f"Translated ({count}): {original[:60]}...")

with open(target_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal translations applied in this batch: {count}")
