<p align="center">
  <img src="assets/screenshot.png" alt="free-code" width="720" />
</p>

<h1 align="center">free-code</h1>

<p align="center">
  <strong>Claude Code 的免费构建版本。</strong><br>
  所有遥测已移除。所有安全护栏已移除。所有实验性功能已解锁。<br>
  一个二进制文件，零回调。
</p>

<p align="center">
  <a href="#quick-install"><img src="https://img.shields.io/badge/install-one--liner-blue?style=flat-square" alt="安装" /></a>
  <a href="https://github.com/paoloanzn/free-code/stargazers"><img src="https://img.shields.io/github/stars/paoloanzn/free-code?style=flat-square" alt="星标" /></a>
  <a href="https://github.com/paoloanzn/free-code/issues"><img src="https://img.shields.io/github/issues/paoloanzn/free-code?style=flat-square" alt="问题" /></a>
  <a href="https://github.com/paoloanzn/free-code/blob/main/FEATURES.md"><img src="https://img.shields.io/badge/features-88%20flags-orange?style=flat-square" alt="功能标志" /></a>
  <a href="#ipfs-mirror"><img src="https://img.shields.io/badge/IPFS-mirrored-teal?style=flat-square" alt="IPFS" /></a>
</p>

---

## 快速安装

```bash
curl -fsSL https://raw.githubusercontent.com/paoloanzn/free-code/main/install.sh | bash
```

检查系统、安装所需的 Bun、克隆仓库、启用所有实验性功能构建，并在 PATH 上创建 `free-code` 符号链接。

然后运行 `free-code` 并使用 `/login` 命令通过您偏好的模型提供商进行身份验证。

---

## 目录

- [这是什么](#what-is-this)
- [模型提供商](#model-providers)
- [快速安装](#quick-install)
- [系统要求](#requirements)
- [构建](#build)
- [使用方法](#usage)
- [实验性功能](#experimental-features)
- [项目结构](#project-structure)
- [技术栈](#tech-stack)
- [IPFS 镜像](#ipfs-mirror)
- [贡献指南](#contributing)
- [许可证](#license)

---

## 这是什么

这是 Anthropic 的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 的一个干净、可构建的分支 —— 一款原生终端 AI 编程代理。上游源代码于 2026 年 3 月 31 日通过 npm 分发版中的 source map 泄露事件公开。

此分支在该快照基础上应用了三类变更：

### 遥测已移除

上游二进制文件通过 OpenTelemetry/gRPC、GrowthBook 分析、Sentry 错误报告和自定义事件日志向服务器回传数据。在此构建版本中：

- 所有出站遥测端点已被死代码消除或打桩处理
- GrowthBook 功能标志评估仍可在本地运行（运行时功能门控需要），但不会回传数据
- 无崩溃报告、无使用分析、无会话指纹识别

### 安全提示护栏已移除

Anthropic 在每次对话中注入系统级指令，对 Claude 的行为施加了超出模型自身约束的限制。这些包括硬编码的拒绝模式、注入的"网络风险"指令块，以及从 Anthropic 服务器推送的托管设置安全覆盖层。

此构建版本剥离了这些注入内容。模型自身的安全训练仍然有效 —— 这只是移除了 CLI 包裹在模型外围的额外提示级限制层。

### 实验性功能已解锁

Claude Code 附带 88 个功能标志，受 `bun:bundle` 编译时开关控制。其中大多数在公开的 npm 版本中被禁用。此构建版本解锁了所有 54 个可正常编译的标志。请参阅下面的 [实验性功能](#experimental-features)，或参考 [FEATURES.md](FEATURES.md) 了解完整审计。

---

## 模型提供商

free-code 开箱即用地支持 **五个 API 提供商**。设置相应的环境变量即可切换提供商 —— 无需修改代码。

### Anthropic（直接 API）—— 默认

直接使用 Anthropic 的官方 API。

| 模型 | ID |
|---|---|
| Claude Opus 4.6 | `claude-opus-4-6` |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` |
| Claude Haiku 4.5 | `claude-haiku-4-5` |

### OpenAI Codex

使用 OpenAI 的 Codex 模型进行代码生成。需要 Codex 订阅。

| 模型 | ID |
|---|---|
| GPT-5.3 Codex（推荐） | `gpt-5.3-codex` |
| GPT-5.4 | `gpt-5.4` |
| GPT-5.4 Mini | `gpt-5.4-mini` |

```bash
export CLAUDE_CODE_USE_OPENAI=1
free-code
```

### AWS Bedrock

通过 Amazon Bedrock 将请求路由到您的 AWS 账户。

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION="us-east-1"   # 或 AWS_DEFAULT_REGION
free-code
```

使用标准 AWS 凭证（环境变量、`~/.aws/config` 或 IAM 角色）。模型会自动映射到 Bedrock ARN 格式（例如 `us.anthropic.claude-opus-4-6-v1`）。

| 变量 | 用途 |
|---|---|
| `CLAUDE_CODE_USE_BEDROCK` | 启用 Bedrock 提供商 |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | AWS 区域（默认：`us-east-1`） |
| `ANTHROPIC_BEDROCK_BASE_URL` | 自定义 Bedrock 端点 |
| `AWS_BEARER_TOKEN_BEDROCK` | Bearer 令牌认证 |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | 跳过认证（测试用） |

### Google Cloud Vertex AI

通过 Vertex AI 将请求路由到您的 GCP 项目。

```bash
export CLAUDE_CODE_USE_VERTEX=1
free-code
```

使用 Google Cloud 应用默认凭证（`gcloud auth application-default login`）。模型会自动映射到 Vertex 格式（例如 `claude-opus-4-6@latest`）。

### Anthropic Foundry

使用 Anthropic Foundry 进行专用部署。

```bash
export CLAUDE_CODE_USE_FOUNDRY=1
export ANTHROPIC_FOUNDRY_API_KEY="..."
free-code
```

支持将自定义部署 ID 用作模型名称。

### 提供商选择摘要

| 提供商 | 环境变量 | 认证方式 |
|---|---|---|
| Anthropic（默认） | -- | `ANTHROPIC_API_KEY` 或 OAuth |
| OpenAI Codex | `CLAUDE_CODE_USE_OPENAI=1` | 通过 OpenAI 进行 OAuth |
| AWS Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` | AWS 凭证 |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` | `gcloud` ADC |
| Anthropic Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` | `ANTHROPIC_FOUNDRY_API_KEY` |

---

## 系统要求

- **运行时**：[Bun](https://bun.sh) >= 1.3.11
- **操作系统**：macOS 或 Linux（Windows 通过 WSL）
- **认证**：您选择的提供商的 API 密钥或 OAuth 登录

```bash
# 如果没有安装 Bun
curl -fsSL https://bun.sh/install | bash
```

---

## 构建

```bash
git clone https://github.com/paoloanzn/free-code.git
cd free-code
bun build
./cli
```

### 构建变体

| 命令 | 输出 | 功能 | 描述 |
|---|---|---|---|
| `bun run build` | `./cli` | 仅 `VOICE_MODE` | 类生产环境二进制文件 |
| `bun run build:dev` | `./cli-dev` | 仅 `VOICE_MODE` | 开发版本标记 |
| `bun run build:dev:full` | `./cli-dev` | 全部 54 个实验标志 | 完全解锁构建 |
| `bun run compile` | `./dist/cli` | 仅 `VOICE_MODE` | 替代输出路径 |

### 自定义功能标志

无需完整捆绑包即可启用特定标志：

```bash
# 仅启用 ultraplan 和 ultrathink
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK

# 在开发构建基础上添加一个标志
bun run ./scripts/build.ts --dev --feature=BRIDGE_MODE
```

---

## 使用方法

```bash
# 交互式 REPL（默认）
./cli

# 一次性模式
./cli -p "这个目录里有哪些文件？"

# 指定模型
./cli --model claude-opus-4-6

# 从源码运行（启动较慢）
bun run dev

# OAuth 登录
./cli /login
```

### 环境变量参考

| 变量 | 用途 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `ANTHROPIC_AUTH_TOKEN` | 认证令牌（替代方式） |
| `ANTHROPIC_MODEL` | 覆盖默认模型 |
| `ANTHROPIC_BASE_URL` | 自定义 API 端点 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | 自定义 Opus 模型 ID |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | 自定义 Sonnet 模型 ID |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 自定义 Haiku 模型 ID |
| `CLAUDE_CODE_OAUTH_TOKEN` | 通过环境变量设置 OAuth 令牌 |
| `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` | API 密钥助手缓存 TTL |

---

## 实验性功能

`bun run build:dev:full` 构建启用了全部 54 个可用功能标志。亮点包括：

### 交互与界面

| 标志 | 描述 |
|---|---|
| `ULTRAPLAN` | Claude Code Web 上的远程多智能体规划（Opus 级别） |
| `ULTRATHINK` | 深度思考模式 —— 输入 "ultrathink" 来增强推理能力 |
| `VOICE_MODE` | 按键通话语音输入和听写 |
| `TOKEN_BUDGET` | 令牌预算跟踪和用量警告 |
| `HISTORY_PICKER` | 交互式提示历史选择器 |
| `MESSAGE_ACTIONS` | UI 中的消息操作入口点 |
| `QUICK_SEARCH` | 提示快速搜索 |
| `SHOT_STATS` | 镜头分布统计 |

### 智能体、记忆与规划

| 标志 | 描述 |
|---|---|
| `BUILTIN_EXPLORE_PLAN_AGENTS` | 内置探索/规划智能体预设 |
| `VERIFICATION_AGENT` | 用于任务验证的验证智能体 |
| `AGENT_TRIGGERS` | 用于后台自动化的本地 cron/触发器工具 |
| `AGENT_TRIGGERS_REMOTE` | 远程触发器工具路径 |
| `EXTRACT_MEMORIES` | 查询后自动记忆提取 |
| `COMPACTION_REMINDERS` | 上下文压缩相关的智能提醒 |
| `CACHED_MICROCOMPACT` | 查询流程中的缓存微压缩状态 |
| `TEAMMEM` | 团队记忆文件和监听器钩子 |

### 工具与基础设施

| 标志 | 描述 |
|---|---|
| `BRIDGE_MODE` | IDE 远程控制桥接（VS Code、JetBrains） |
| `BASH_CLASSIFIER` | 分类器辅助的 bash 权限决策 |
| `PROMPT_CACHE_BREAK_DETECTION` | 压缩/查询流程中的缓存中断检测 |

请参阅 [FEATURES.md](FEATURES.md) 了解所有 88 个标志的完整审计，包括 34 个损坏标志的修复说明。

---

## 项目结构

```
scripts/
  build.ts                # 带功能标志系统的构建脚本

src/
  entrypoints/cli.tsx     # CLI 入口点
  commands.ts             # 命令注册表（斜杠命令）
  tools.ts                # 工具注册表（智能体工具）
  QueryEngine.ts          # LLM 查询引擎
  screens/REPL.tsx        # 主要交互式 UI（Ink/React）

  commands/               # /斜杠命令实现
  tools/                  # 智能体工具实现（Bash、Read、Edit 等）
  components/             # Ink/React 终端 UI 组件
  hooks/                  # React hooks
  services/               # API 客户端、MCP、OAuth、分析
    api/                  # API 客户端 + Codex fetch 适配器
    oauth/                # OAuth 流程（Anthropic + OpenAI）
  state/                  # 应用状态存储
  utils/                  # 工具函数
    model/                # 模型配置、提供商、验证
  skills/                 # 技能系统
  plugins/                # 插件系统
  bridge/                 # IDE 桥接
  voice/                  # 语音输入
  tasks/                  # 后台任务管理
```

---

## 技术栈

| | |
|---|---|
| **运行时** | [Bun](https://bun.sh) |
| **语言** | TypeScript |
| **终端 UI** | React + [Ink](https://github.com/vadimdemedes/ink) |
| **CLI 解析** | [Commander.js](https://github.com/tj/commander.js) |
| **Schema 验证** | Zod v4 |
| **代码搜索** | ripgrep（已捆绑） |
| **协议** | MCP、LSP |
| **API** | Anthropic Messages、OpenAI Codex、AWS Bedrock、Google Vertex AI |

---

## IPFS 镜像

本仓库的完整副本通过 Filecoin 永久固定在 IPFS 上：

| | |
|---|---|
| **CID** | `bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm` |
| **网关** | https://w3s.link/ipfs/bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm |

如果此仓库被下架，代码依然存在。

---

## 贡献指南

欢迎贡献。如果您正在修复 34 个损坏功能标志中的某一个，请先查看 [FEATURES.md](FEATURES.md) 中的修复说明 —— 许多已经接近可编译状态，只需要一个小的包装器或缺失的资源。

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feat/my-feature`）
3. 提交您的更改（`git commit -m 'feat: add something'`）
4. 推送到分支（`git push origin feat/my-feature`）
5. 开启 Pull Request

---

## 许可证

原始 Claude Code 源代码是 Anthropic 的财产。此分支的存在是因为源代码通过其 npm 分发版被公开泄露。请自行斟酌使用。
