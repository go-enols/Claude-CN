<p align="center">
  <img src="assets/screenshot.png" alt="free-code" width="720" />
</p>
<h1 align="center">free-code</h1>
<p align="center">
  <strong>Claude Code 的自由构建版本。</strong>

  移除所有遥测。解除所有限制。解锁所有实验性功能。

  一个二进制文件，零回传。
</p>
<p align="center">
  <a href="#quick-install"><img src="https://img.shields.io/badge/install-one--liner-blue?style=flat-square" alt="Install" /></a>
  <a href="https://github.com/paoloanzn/free-code/stargazers"><img src="https://img.shields.io/github/stars/paoloanzn/free-code?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/paoloanzn/free-code/issues"><img src="https://img.shields.io/github/issues/paoloanzn/free-code?style=flat-square" alt="Issues" /></a>
  <a href="https://github.com/paoloanzn/free-code/blob/main/FEATURES.md"><img src="https://img.shields.io/badge/features-88%20flags-orange?style=flat-square" alt="Feature Flags" /></a>
  <a href="#ipfs-mirror"><img src="https://img.shields.io/badge/IPFS-mirrored-teal?style=flat-square" alt="IPFS" /></a>
</p>
---
## 快速安装
```bash
curl -fsSL https://raw.githubusercontent.com/paoloanzn/free-code/main/install.sh | bash
```
检测你的系统，按需安装 Bun，克隆仓库，启用所有实验性功能进行构建，并将 `free-code` 软链接到你的 PATH 中。
之后运行 `free-code` 并使用 `/login` 命令通过你偏好的模型提供商进行认证。
---
## 目录
- [这是什么](#这是什么)
- [模型提供商](#模型提供商)
- [快速安装](#快速安装)
- [环境要求](#环境要求)
- [构建](#构建)
- [使用方式](#使用方式)
- [实验性功能](#实验性功能)
- [项目结构](#项目结构)
- [技术栈](#技术栈)
- [IPFS 镜像](#ipfs-镜像)
- [参与贡献](#参与贡献)
- [许可证](#许可证)
---
## 这是什么
Anthropic 的 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI 的一个干净、可构建的分支 —— 一款终端原生 AI 编程代理。本分支移除了所有遥测，解除了所有限制，并解锁了每一个实验性功能标志。

可以把它理解为：解除束缚的 Claude Code。
## 模型提供商
free-code 支持你带来的任何模型提供商。只需设置正确的环境变量：
### Anthropic（默认）
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```
### OpenRouter
```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1"
export ANTHROPIC_API_KEY="sk-or-v1-..."
export ANTHROPIC_MODEL="anthropic/claude-sonnet-4-20250514"
export ANTHROPIC_SMALL_FAST_MODEL="anthropic/claude-sonnet-4-20250514"
```
### Google Vertex AI
```bash
export CLOUD_ML_REGION="us-east5"
export ANTHROPIC_MODEL="claude-sonnet-4-5-20260605"
export ANTHROPIC_SMALL_FAST_MODEL="claude-sonnet-4-5-20260605"
```
### 自定义 OpenAI 兼容端点
```bash
export ANTHROPIC_BASE_URL="https://your-endpoint/v1"
export ANTHROPIC_API_KEY="your-key"
export ANTHROPIC_MODEL="your-model-id"
```
### LiteLLM 代理
```bash
export ANTHROPIC_BASE_URL="http://localhost:4000"
export ANTHROPIC_API_KEY="sk-..."
export ANTHROPIC_MODEL="claude-sonnet-4-5-20260605"
```
## 环境要求
- **Node.js** 18+（或 Bun）
- **Bun** 1.3.11+（唯一的构建工具）
- **git** 2.25+
- **macOS** 10.15+ 或 **Linux**（Ubuntu 20.04+、Debian 11+ 等）
- **Python** 3.10+（可选，某些工具需要）
## 构建
```bash
# 克隆仓库
git clone https://github.com/paoloanzn/free-code.git
cd free-code

# 安装依赖
bun install

# 构建（启用所有实验性功能，无遥测）
bun run build:dev:full
```
输出：`./cli-dev`
## 使用方式
```bash
# 交互式 REPL
./cli-dev

# 一次性执行
./cli-dev -p "解释这个代码库"

# 管道输入
echo "git status 有什么作用？" | ./cli-dev

# 使用 OAuth 登录
./cli-dev /login
```
在环境变量中设置 `ANTHROPIC_API_KEY`，或使用 `/login` 命令通过你偏好的模型提供商进行认证。
## 实验性功能
所有 88 个实验性功能标志默认启用。完整列表见 [FEATURES.md](FEATURES.md)。
## 项目结构
```
src/
├── entrypoints/     # CLI 入口点（cli.tsx、agentSdkTypes.ts 等）
├── screens/         # 终端 UI 界面（REPL.tsx 等）
├── commands/        # 斜杠命令实现
├── tools/           # 工具实现（Bash、Read、Write 等）
├── components/      # 可复用的 Ink/React 终端组件
├── hooks/           # React hooks
├── services/        # API 客户端、OAuth、MCP、分析
├── skills/          # 技能系统
├── plugins/         # 插件系统
├── bridge/          # IDE 桥接
├── voice/           # 语音输入
├── tasks/           # 后台任务管理
├── constants/       # 提示词和常量
├── state/           # 应用状态存储
├── utils/           # 工具函数
└── QueryEngine.ts   # LLM 查询管道
```
## 技术栈
| 组件 | 技术 |
|-----------|-----------|
| 运行时 | Bun |
| 语言 | TypeScript |
| UI 框架 | Ink（用于终端的 React） |
| 构建系统 | Bun.build |
| AI SDK | @anthropic-ai/sdk |
| MCP | @modelcontextprotocol/sdk |
| Shell | Bun Shell |
| 插件 | jiti |
## IPFS 镜像
本仓库在 IPFS 上有镜像，以实现抗审查：
- **CIDv1**：`bafybeife4idqee4nmb4hoqmb4futyk3hl3gjliq422qbvb7qo3v4ex4q7q`
- **网关**：https://ipfs.io/ipfs/bafybeife4idqee4nmb4hoqmb4futyk3hl3gjliq422qbvb7qo3v4ex4q7q
## 参与贡献
欢迎提交 Issue 和 PR。保持简洁，保持可用。
## 许可证
MIT