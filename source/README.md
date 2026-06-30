<p align="center">
  <img src="assets/screenshot.png" alt="free-code" width="720" />
</p>

<h1 align="center">free-code</h1>

<p align="center">
  <strong>Claude Code 的免费构建版本。</strong><br>
  移除所有遥测。去除所有限制。解锁所有实验性功能。<br>
  单一二进制文件，零回传。
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

检查你的系统，按需安装 Bun，克隆仓库，启用所有实验性功能进行构建，并将 `free-code` 软链接到你的 PATH。

然后运行 `free-code` 并使用 `/login` 命令通过你选择的模型提供商进行身份验证。

---

## 目录

- [这是什么](#这是什么)
- [模型提供商](#模型提供商)
- [快速安装](#快速安装)
- [环境要求](#环境要求)
- [构建](#构建)
- [使用](#使用)
- [实验性功能](#实验性功能)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [IPFS 镜像](#ipfs-镜像)
- [贡献](#贡献)
- [许可证](#许可证)

---

## 这是什么

Anthropic 的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 的一个干净、可构建的分支 —— 原生终端的 AI 编程代理。上游源码于 2026 年 3 月 31 日通过 npm 分发包中的 source map 泄露而公开。

此分叉在该快照的基础上应用了三类修改：

### 移除遥测

上游二进制文件通过 OpenTelemetry/gRPC、GrowthBook 分析、Sentry 错误报告和自定义事件日志进行回传。在此构建中：

- 所有出站遥测端点均已死代码消除或存根化
- GrowthBook 功能标志评估仍在本地运行（运行时功能开关需要），但不会回传报告
- 无崩溃报告、无使用分析、无会话指纹

### 移除安全提示限制

Anthropic 在每次对话中注入系统级指令，约束 Claude 的行为，超出模型自身执行的限制。这些包括硬编码的拒绝模式、注入的"网络风险"指令块，以及从 Anthropic 服务器推送的托管设置安全覆盖层。

此构建移除了这些注入。模型自身的安全训练仍然适用 —— 这只是移除了 CLI 包裹在模型周围的额外提示级限制层。

### 解锁实验性功能

Claude Code 内置了 88 个功能标志，通过 `bun:bundle` 编译时开关控制。大多数在公开的 npm 发布版本中被禁用。此构建解锁了所有能够干净编译的 54 个标志。请参阅下方的[实验性功能](#实验性功能)，或查看 [FEATURES.md](FEATURES.md) 了解完整审计。

---

## 模型提供商

free-code 开箱即用支持**五种 API 提供商**。设置相应的环境变量即可切换提供商 —— 无需修改代码。

### Anthropic（直接 API）-- 默认

直接使用 Anthropic 的第一方 API。

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

通过 Amazon Bedrock 将请求路由到你的 AWS 账户。

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION="us-east-1"   # 或 AWS_DEFAULT_REGION
free-code
```

使用你的标准 AWS 凭证（环境变量、`~/.aws/config` 或 IAM 角色）。模型会自动映射为 Bedrock ARN 格式（例如 `us.anthropic.claude-opus-4-6-v1`）。

| 变量 | 用途 |
|---|---|
| `CLAUDE_CODE_USE_BEDROCK` | 启用 Bedrock 提供商 |
| `AWS_REGION` / `AWS_DEFAULT_REGION` | AWS 区域（默认：`us-east-1`） |
| `ANTHROPIC_BEDROCK_BASE_URL` | 自定义 Bedrock 端点 |
| `AWS_BEARER_TOKEN_BEDROCK` | Bearer 令牌认证 |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | 跳过认证（测试用） |

### Google Cloud Vertex AI

通过 Vertex AI 将请求路由到你的 GCP 项目。

```bash
export CLAUDE_CODE_USE_VERTEX=1
free-code
```

使用 Google Cloud 应用默认凭证（`gcloud auth application-default login`）。模型会自动映射为 Vertex 格式（例如 `claude-opus-4-6@latest`）。

### Anthropic Foundry

使用 Anthropic Foundry 进行专用部署。

```bash
export CLAUDE_CODE_USE_FOUNDRY=1
export ANTHROPIC_FOUNDRY_API_KEY="..."
free-code
```

支持将自定义部署 ID 作为模型名称。

### 提供商选择摘要

| 提供商 | 环境变量 | 认证方式 |
|---|---|---|
| Anthropic（默认） | -- | `ANTHROPIC_API_KEY` 或 OAuth |
| OpenAI Codex | `CLAUDE_CODE_USE_OPENAI=1` | 通过 OpenAI 的 OAuth |
| AWS Bedrock | `CLAUDE_CODE_USE_BEDROCK=1` | AWS 凭证 |
| Google Vertex AI | `CLAUDE_CODE_USE_VERTEX=1` | `gcloud` ADC |
| Anthropic Foundry | `CLAUDE_CODE_USE_FOUNDRY=1` | `ANTHROPIC_FOUNDRY_API_KEY` |

---

## 环境要求

- **运行时**：[Bun](https://bun.sh) >= 1.3.11
- **操作系统**：macOS 或 Linux（Windows 通过 WSL）
- **认证**：所选提供商的 API 密钥或 OAuth 登录

```bash
# 如果没有安装 Bun，请执行以下命令
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
| `bun run build:dev:full` | `./cli-dev` | 全部 54 个实验性标志 | 完全解锁构建 |
| `bun run compile` | `./dist/cli` | 仅 `VOICE_MODE` | 备用输出路径 |

### 自定义功能标志

在不使用完整包的情况下启用特定标志：

```bash
# 仅启用 ultraplan 和 ultrathink
bun run ./scripts/build.ts --feature=ULTRAPLAN --feature=ULTRATHINK

# 在开发构建的基础上添加一个标志
bun run ./scripts/build.ts --dev --feature=BRIDGE_MODE
```

---

## 使用

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
| `ANTHROPIC_AUTH_TOKEN` | 认证令牌（备选） |
| `ANTHROPIC_MODEL` | 覆盖默认模型 |
| `ANTHROPIC_BASE_URL` | 自定义 API 端点 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | 自定义 Opus 模型 ID |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | 自定义 Sonnet 模型 ID |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | 自定义 Haiku 模型 ID |
| `CLAUDE_CODE_OAUTH_TOKEN` | 通过环境变量的 OAuth 令牌 |
| `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` | API 密钥辅助缓存 TTL |

---

## 实验性功能

`bun run build:dev:full` 构建启用了全部 54 个可用的功能标志。亮点：

### 交互与界面

| 标志 | 描述 |
|---|---|
| `ULTRAPLAN` | 在 Claude Code Web 上的远程多代理规划（Opus 级别） |
| `ULTRATHINK` | 深度思考模式 —— 输入 "ultrathink" 以增强推理强度 |
| `VOICE_MODE` | 按键通话语音输入和听写 |
| `TOKEN_BUDGET` | Token 预算跟踪和使用警告 |
| `HISTORY_PICKER` | 交互式提示历史选择器 |
| `MESSAGE_ACTIONS` | 界面中的消息操作入口 |
| `QUICK_SEARCH` | 提示快速搜索 |
| `SHOT_STATS` | Shot 分布统计 |

### 代理、记忆与规划

| 标志 | 描述 |
|---|---|
| `BUILTIN_EXPLORE_PLAN_AGENTS` | 内置探索/规划代理预设 |
| `VERIFICATION_AGENT` | 用于任务验证的验证代理 |
| `AGENT_TRIGGERS` | 用于后台自动化的本地 cron/触发器工具 |
| `AGENT_TRIGGERS_REMOTE` | 远程触发器工具路径 |
| `EXTRACT_MEMORIES` | 查询后自动记忆提取 |
| `COMPACTION_REMINDERS` | 上下文压缩相关的智能提醒 |
| `CACHED_MICROCOMPACT` | 跨查询流程的缓存微压缩状态 |
| `TEAMMEM` | 团队记忆文件和监听钩子 |

### 工具与基础设施

| 标志 | 描述 |
|---|---|
| `BRIDGE_MODE` | IDE 远程控制桥接（VS Code、JetBrains） |
| `BASH_CLASSIFIER` | 分类器辅助的 bash 权限决策 |
| `PROMPT_CACHE_BREAK_DETECTION` | 压缩/查询流程中的缓存中断检测 |

完整审计请参见 [FEATURES.md](FEATURES.md)，涵盖全部 88 个标志，包括 34 个损坏标志及重建说明。

---

## 项目结构

```
scripts/
  build.ts                # 构建脚本，包含功能标志系统

src/
  entrypoints/cli.tsx     # CLI 入口点
  commands.ts             # 命令注册表（斜杠命令）
  tools.ts                # 工具注册表（代理工具）
  QueryEngine.ts          # LLM 查询引擎
  screens/REPL.tsx        # 主交互界面（Ink/React）

  commands/               # /slash 命令实现
  tools/                  # 代理工具实现（Bash、Read、Edit 等）
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
| **模式验证** | Zod v4 |
| **代码搜索** | ripgrep（内置） |
| **协议** | MCP、LSP |
| **API** | Anthropic Messages、OpenAI Codex、AWS Bedrock、Google Vertex AI |

---

## IPFS 镜像

此仓库的完整副本通过 Filecoin 永久固定在 IPFS 上：

| | |
|---|---|
| **CID** | `bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm` |
| **网关** | https://w3s.link/ipfs/bafybeiegvef3dt24n2znnnmzcud2vxat7y7rl5ikz7y7yoglxappim54bm |

即使此仓库被下架，代码仍然存在。

---

## 贡献

欢迎贡献。如果你正在恢复 34 个损坏功能标志中的某一个，请先查看 [FEATURES.md](FEATURES.md) 中的重建说明 —— 许多标志已经接近可编译状态，只需一个小的包装器或缺失的资产即可。

1. Fork 本仓库
2. 创建功能分支（`git checkout -b feat/my-feature`）
3. 提交你的更改（`git commit -m 'feat: add something'`）
4. 推送到分支（`git push origin feat/my-feature`）
5. 创建一个 Pull Request

---

## 许可证

原始 Claude Code 源码归 Anthropic 所有。此分叉的存在是因为源码已通过其 npm 分发包公开暴露。请自行酌情使用。