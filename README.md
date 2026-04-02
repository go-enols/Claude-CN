# Claude-CN (Claude汉化版)

**FreeCode Claude Code 的汉化中文版本。**

本项目是 [free-code](https://github.com/paoloanzn/free-code) 的汉化分支，致力于为中文用户提供更好的使用体验。

> **⚠️ 汉化工作正在进行中** - 部分界面和文档正在逐步汉化，如有问题欢迎提交Issue。

---

## 特性

- 完整的汉化界面与文档
- 移除了所有遥测和回拨
- 移除了安全提示限制
- 解锁所有实验性功能

---

## 快速安装

```bash
curl -fsSL https://raw.githubusercontent.com/go-enols/Claude-CN/main/install.sh | bash
```

此脚本将自动检测系统、安装 Bun（如需要）、克隆代码库、构建并启用所有功能，然后将其添加到 PATH 中。

安装完成后，运行以下命令启动：
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
claude-cn
```

---

## 系统要求

- [Bun](https://bun.sh) >= 1.3.11
- macOS 或 Linux（Windows 通过 WSL）
- Anthropic API 密钥（在环境变量中设置 `ANTHROPIC_API_KEY`）

```bash
# 如果没有安装 Bun
curl -fsSL https://bun.sh/install | bash
```

---

## 手动构建

```bash
# 克隆仓库
git clone https://github.com/go-enols/Claude-CN.git
cd Claude-CN

# 安装依赖
bun install

# 标准构建 -- 生成 ./cli
bun run build

# 开发构建 -- 开发版本标识
bun run build:dev

# 启用所有实验性功能的开发构建 -- 生成 ./cli-dev
bun run build:dev:full

# 编译构建（备用输出路径）-- 生成 ./dist/cli
bun run compile
```

### 构建变体

| 命令 | 输出 | 功能 | 说明 |
|---|---|---|---|
| `bun run build` | `./cli` | 仅 `VOICE_MODE` | 生产级二进制文件 |
| `bun run build:dev` | `./cli-dev` | 仅 `VOICE_MODE` | 开发版本标识 |
| `bun run build:dev:full` | `./cli-dev` | 所有45+实验性标志 | 完整解锁构建 |
| `bun run compile` | `./dist/cli` | 仅 `VOICE_MODE` | 备用输出目录 |

### 单独启用功能标志

您可以在不完全打包的情况下启用特定标志：

```bash
# 仅启用 ultraplan 和 ultrathink
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK

# 在开发构建基础上启用特定标志
bun run ./scripts/build.ts --dev --feature=BRIDGE_MODE
```

---

## 运行

```bash
# 直接运行构建的二进制文件
./cli

# 或运行开发二进制文件
./cli-dev

# 或从源码运行（启动较慢）
bun run dev

# 设置 API 密钥
export ANTHROPIC_API_KEY="sk-ant-..."

# 或使用 Claude.ai OAuth 登录
./cli /login
```

### 快速测试

```bash
# 单次执行模式
./cli -p "当前目录下有哪些文件？"

# 交互式 REPL（默认）
./cli

# 使用指定模型
./cli --model claude-sonnet-4-6-20250514
```

---

## 核心改动

本项目在原始代码基础上应用了三类改动：

### 1. 移除遥测

上游二进制文件通过 OpenTelemetry/gRPC、GrowthBook 分析、Sentry 错误报告和自定义事件日志向外部发送数据。本构建中：

- 所有出站遥测端点均被消除或存根
- GrowthBook 功能标志评估仍在本地工作（用于运行时功能门控），但不回报
- 无崩溃报告、无使用分析、无会话指纹

### 2. 移除安全提示限制

Anthropic 在每次对话中注入系统级指令，超出模型本身的约束，包括：

- 某些类别提示的硬编码拒绝模式
- 注入的"网络风险"指令块
- 从 Anthropic 服务器推送的托管设置安全覆盖

本构建剥离了这些注入。模型本身的安全训练仍然适用——这只是移除了 CLI 围绕它的额外提示级限制层。

### 3. 启用实验性功能

Claude Code 附带数十个通过 `bun:bundle` 编译时开关门控的功能标志。本构建解锁了所有能正常编译的 45+ 个标志，包括：

| 功能标志 | 说明 |
|---|---|
| `ULTRAPLAN` | Claude Code 网页上的远程多智能体规划（Opus级别） |
| `ULTRATHINK` | 深度思考模式 - 输入"ultrathink"提升推理努力 |
| `VOICE_MODE` | 按键通话语音输入和听写 |
| `AGENT_TRIGGERS` | 后台自动化本地 cron/触发器工具 |
| `BRIDGE_MODE` | IDE 远程控制桥（VS Code、JetBrains） |
| `TOKEN_BUDGET` | Token 预算跟踪和使用警告 |
| `BUILTIN_EXPLORE_PLAN_AGENTS` | 内置探索/规划智能体预设 |
| `VERIFICATION_AGENT` | 任务验证智能体 |
| `BASH_CLASSIFIER` | 分类器辅助的 bash 权限决策 |
| `EXTRACT_MEMORIES` | 查询后自动记忆提取 |
| `HISTORY_PICKER` | 交互式提示历史选择器 |
| `MESSAGE_ACTIONS` | UI 中的消息操作入口点 |
| `QUICK_SEARCH` | 提示快速搜索 |
| `SHOT_STATS` | Shot分布统计 |
| `COMPACTION_REMINDERS` | 上下文压缩周围的智能提醒 |
| `CACHED_MICROCOMPACT` | 通过查询流程的缓存微压缩状态 |

完整的功能标志审计请参阅 [FEATURES.md](FEATURES.md)。

---

## 项目结构

```
scripts/
  build.ts              # 构建脚本与功能标志系统

src/
  entrypoints/cli.tsx   # CLI 入口点
  commands.ts           # 命令注册表（斜杠命令）
  tools.ts              # 工具注册表（智能体工具）
  QueryEngine.ts        # LLM 查询引擎
  screens/REPL.tsx      # 主交互式 UI

  commands/             # /斜杠命令实现
  tools/                # 智能体工具实现（Bash、Read、Edit 等）
  components/           # Ink/React 终端 UI 组件
  hooks/                # React hooks
  services/             # API 客户端、MCP、OAuth、分析
  state/                # 应用状态存储
  utils/                # 工具函数
  skills/               # 技能系统
  plugins/              # 插件系统
  bridge/               # IDE 桥接
  voice/                # 语音输入
  tasks/                # 后台任务管理
```

---

## 技术栈

| | |
|---|---|
| 运行时 | [Bun](https://bun.sh) |
| 语言 | TypeScript |
| 终端 UI | React + [Ink](https://github.com/vadimdemedes/ink) |
| CLI 解析 | [Commander.js](https://github.com/tj/commander.js) |
| Schema 验证 | Zod v4 |
| 代码搜索 | ripgrep（已打包） |
| 协议 | MCP、LSP |
| API | Anthropic Messages API |

---

## IPFS 镜像

此仓库的完整副本通过 Filecoin 永久固定在 IPFS 上：

- **CID:** `bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm`
- **Gateway:** https://w3s.link/ipfs/bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm

如果此仓库被删除，代码将永远存在。

---

## 许可证

原始 Claude Code 源代码是 Anthropic 的财产。此分支的存在是因为源代码通过其 npm 分发中的源映射暴露而公开可用。自行决定使用。

---

## 参与贡献

汉化工作正在进行中，欢迎提交 PR 和 Issue！
