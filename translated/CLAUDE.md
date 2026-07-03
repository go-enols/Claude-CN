# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在处理本仓库代码时提供指导。

## 常用命令

```bash
# 安装依赖
bun install

# 标准构建（输出 ./cli）
bun run build

# 开发构建（输出 ./cli-dev）
bun run build:dev

# 启用所有实验性功能的开发构建（输出 ./cli-dev）
bun run build:dev:full

# 编译构建（输出 ./dist/cli）
bun run compile

# 从源码运行（无需编译）
bun run dev
```

使用 `./cli` 或 `./cli-dev` 运行构建后的二进制文件。在环境变量中设置 `ANTHROPIC_API_KEY`，或通过 `./cli /login` 使用 OAuth 登录。

## 高层架构

- **入口点/UI 循环**：src/entrypoints/cli.tsx 引导 CLI 启动，主要交互式 UI 位于 src/screens/REPL.tsx（Ink/React）。
- **命令/工具注册表**：src/commands.ts 注册斜杠命令；src/tools.ts 注册工具实现。实现代码位于 src/commands/ 和 src/tools/ 目录中。
- **LLM 查询流水线**：src/QueryEngine.ts 协调消息流、工具使用和模型调用。
- **核心子系统**：
  - src/services/：API 客户端、OAuth/MCP 集成、分析桩代码
  - src/state/：应用状态存储
  - src/hooks/：UI/流程使用的 React hooks
  - src/components/：终端 UI 组件（Ink）
  - src/skills/：技能系统
  - src/plugins/：插件系统
  - src/bridge/：IDE 桥接
  - src/voice/：语音输入
  - src/tasks/：后台任务管理

## 构建系统

- scripts/build.ts 是构建脚本和功能标志打包器。功能标志通过构建参数设置（例如 `--feature=ULTRAPLAN`）或预设（如 `--feature-set=dev-full`）设置（详见 README）。
