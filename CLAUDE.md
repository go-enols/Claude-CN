# CLAUDE.md
本文件为 Claude Code（claude.ai/code）在此仓库中处理代码时提供指导。

## 汉化指南 (Localization Guide)
**汉化策略**: 采用硬编码方式直接替换用户可见字符串，不使用 i18n 框架。
**要求**：你必须真实的检查每一个文件，如果改文件不需要汉化，你必须在文件末尾增加一个换行
**如何检查进度**： 使用git status获取变更的文件数量与项目文件数量做对比
**禁止做**：禁止捏造事实，禁止需要汉化时不汉化，禁止只检查部分文件而不检查所有文件就猜猜完成了
### 汉化范围
- **需要汉化**: 终端 UI 文案、命令描述/帮助文本、错误提示、状态消息、Spinner 文案、对话框文本、命令输出
- **不要汉化**: 变量名、函数名、类名、文件路径、API 密钥/模型 ID、环境变量名、agent 系统提示词（`src/constants/prompts.ts`、`src/constants/systemPromptSections.ts`）、工具定义中的 `name` 字段、任何影响代码逻辑的字符串

## 常用命令
```bash
# 安装依赖
bun install
# 标准构建（./cli）
bun run build
# 开发构建（./cli-dev）
bun run build:dev
# 包含所有实验性功能的开发构建（./cli-dev）
bun run build:dev:full
# 编译构建（./dist/cli）
bun run compile
# 从源码运行（不编译）
bun run dev
```
使用 `./cli` 或 `./cli-dev` 运行构建后的二进制文件。在环境变量中设置 `ANTHROPIC_API_KEY`，或通过 `./cli /login` 使用 OAuth 登录。

## 高层架构
- **入口/UI 循环**：src/entrypoints/cli.tsx 引导 CLI 启动，主交互界面位于 src/screens/REPL.tsx（Ink/React）。
- **命令/工具注册表**：src/commands.ts 注册斜杠命令；src/tools.ts 注册工具实现。具体实现位于 src/commands/ 和 src/tools/ 目录下。
- **LLM 查询管道**：src/QueryEngine.ts 协调消息流、工具调用和模型调用。
- **核心子系统**：
  - src/services/：API 客户端、OAuth/MCP 集成、分析桩
  - src/state/：应用状态存储
  - src/hooks/：UI/流程使用的 React Hooks
  - src/components/：终端 UI 组件（Ink）
  - src/skills/：技能系统
  - src/plugins/：插件系统
  - src/bridge/：IDE 桥接
  - src/voice/：语音输入
  - src/tasks/：后台任务管理
## 构建系统
- scripts/build.ts 是构建脚本和功能标志打包器。功能标志通过构建参数（例如 `--feature=ULTRAPLAN`）或预设（如 `--feature-set=dev-full`）设置（详见 README）。