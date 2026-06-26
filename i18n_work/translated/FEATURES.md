# 功能标志审计

审计日期：2026-03-31

此仓库当前引用了 88 个 `feature('FLAG')` 编译时标志。
我通过在当前外部构建定义和外部模块的基础上，每个标志单独捆绑 CLI 来重新检查它们。结果：

- 54 个标志在此快照中可干净捆绑
- 34 个标志仍无法捆绑

重要提示："可干净捆绑"并不总是意味着"运行时安全"。某些标志仍然依赖于可选的原生模块、claude.ai OAuth、GrowthBook 门控或外部化的 `@ant/*` 包。

## 构建变体

- `bun run build`
  构建常规的外部二进制文件，输出到 `./cli`。
- `bun run compile`
  构建常规的外部二进制文件，输出到 `./dist/cli`。
- `bun run build:dev`
  构建 `./cli-dev`，带有开发版本标记和实验性 GrowthBook 密钥。
- `bun run build:dev:full`
  构建 `./cli-dev`，包含本文档中当前的完整"工作实验性功能"
  捆绑包，减去 `CHICAGO_MCP`。该标志仍可编译，
  但外部二进制文件无法干净启动，因为启动时
  会访问缺失的 `@ant/computer-use-mcp` 运行时包。

## 默认构建标志

- `VOICE_MODE`
  现已包含在默认构建流水线中，而不仅仅是开发构建。
  它启用了 `/voice`、按键通话 UI、语音通知和听写管道。
  运行时仍依赖 claude.ai OAuth 以及原生音频模块
  或备用录音器（如 SoX）。

## 工作实验性功能

以下是当前可干净捆绑的用户可见或行为变更标志，
在此快照中应仍视为实验性，除非明确标注为默认启用。

### 交互与 UI 实验

- `AWAY_SUMMARY`
  在 REPL 中添加离开键盘摘要行为。
- `HISTORY_PICKER`
  启用交互式提示历史选择器。
- `HOOK_PROMPTS`
  将提示/请求文本传递到钩子执行流程中。
- `KAIROS_BRIEF`
  启用仅简报转录布局和面向 BriefTool 的 UX，
  不包含完整的助手栈。
- `KAIROS_CHANNELS`
  启用渠道通知和围绕 MCP/渠道消息传递的渠道回调管道。
- `LODESTONE`
  启用深度链接/协议注册相关流程和设置接线。
- `MESSAGE_ACTIONS`
  在交互式 UI 中启用消息操作入口。
- `NEW_INIT`
  启用较新的 `/init` 决策路径。
- `QUICK_SEARCH`
  启用提示快速搜索行为。
- `SHOT_STATS`
  启用额外的快照分布统计视图。
- `TOKEN_BUDGET`
  启用 Token 预算跟踪、提示触发器和 Token 警告 UI。
- `ULTRAPLAN`
  启用 `/ultraplan`、提示触发器和退出计划功能。
- `ULTRATHINK`
  启用额外思考深度模式切换。
- `VOICE_MODE`
  启用语音切换、听写快捷键、语音通知和语音 UI。

### 代理、记忆与规划实验

- `AGENT_MEMORY_SNAPSHOT`
  在应用中存储额外的自定义代理记忆快照状态。
- `AGENT_TRIGGERS`
  启用本地 cron/触发器工具和捆绑的触发器相关技能。
- `AGENT_TRIGGERS_REMOTE`
  启用远程触发器工具路径。
- `BUILTIN_EXPLORE_PLAN_AGENTS`
  启用内置探索/规划代理预设。
- `CACHED_MICROCOMPACT`
  在查询和 API 流中启用缓存微压缩状态。
- `COMPACTION_REMINDERS`
  启用围绕压缩和附件流程的提醒文案。
- `EXTRACT_MEMORIES`
  启用查询后记忆提取钩子。
- `PROMPT_CACHE_BREAK_DETECTION`
  启用围绕压缩/查询/API 流的缓存中断检测。
- `TEAMMEM`
  启用团队记忆文件、观察器钩子和相关 UI 消息。
- `VERIFICATION_AGENT`
  在提示和任务/待办事项工具中启用验证代理指导。

### 工具、权限与远程实验

- `BASH_CLASSIFIER`
  启用分类器辅助的 bash 权限决策。
- `BRIDGE_MODE`
  启用远程控制/REPL 桥接命令和授权路径。
- `CCR_AUTO_CONNECT`
  启用 CCR 自动连接默认路径。
- `CCR_MIRROR`
  启用仅出站 CCR 镜像会话。
- `CCR_REMOTE_SETUP`
  启用远程设置命令路径。
- `CHICAGO_MCP`
  启用计算机使用 MCP 集成路径和包装器加载。
- `CONNECTOR_TEXT`
  在 API/日志/UI 路径中启用连接器文本块处理。
- `MCP_RICH_OUTPUT`
  启用更丰富的 MCP UI 渲染。
- `NATIVE_CLIPBOARD_IMAGE`
  启用原生 macOS 剪贴板图像快速路径。
- `POWERSHELL_AUTO_MODE`
  启用 PowerShell 特定的自动模式权限处理。
- `TREE_SITTER_BASH`
  启用 tree-sitter bash 解析器后端。
- `TREE_SITTER_BASH_SHADOW`
  启用 tree-sitter bash 影子推广路径。
- `UNATTENDED_RETRY`
  在 API 重试流程中启用无人值守重试行为。

## 可捆绑的支持标志

这些也可以干净捆绑，但它们主要是推广、平台、遥测或管道切换开关，
而非面向用户的实验性功能。

- `ABLATION_BASELINE`
  CLI 消融/基准入口点切换。
- `ALLOW_TEST_VERSIONS`
  允许原生安装器流程中的测试版本。
- `ANTI_DISTILLATION_CC`
  添加反蒸馏请求元数据。
- `BREAK_CACHE_COMMAND`
  注入中断缓存命令路径。
- `COWORKER_TYPE_TELEMETRY`
  添加工友类型遥测字段。
- `DOWNLOAD_USER_SETTINGS`
  启用设置同步拉取路径。
- `DUMP_SYSTEM_PROMPT`
  启用系统提示转储路径。
- `FILE_PERSISTENCE`
  启用文件持久化管道。
- `HARD_FAIL`
  启用更严格的失败/日志行为。
- `IS_LIBC_GLIBC`
  强制 glibc 环境检测。
- `IS_LIBC_MUSL`
  强制 musl 环境检测。
- `NATIVE_CLIENT_ATTESTATION`
  在系统头部添加原生认证标记文本。
- `PERFETTO_TRACING`
  启用 perfetto 跟踪钩子。
- `SKILL_IMPROVEMENT`
  启用技能改进钩子。
- `SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED`
  在自动更新禁用时跳过更新器检测。
- `SLOW_OPERATION_LOGGING`
  启用慢操作日志。
- `UPLOAD_USER_SETTINGS`
  启用设置同步推送路径。

## 编译安全但有运行时限制

以下标志当前可以捆绑，但由于存在显著的运行时限制，
我仍将其视为实验性：

- `VOICE_MODE`
  可干净捆绑，但需要 claude.ai OAuth 和本地录音后端。
  原生音频模块现在是可选的；在此机器上备用路径
  要求 `brew install sox`。
- `NATIVE_CLIPBOARD_IMAGE`
  可干净捆绑，但仅在存在 `image-processor-napi` 时
  加速 macOS 剪贴板读取。
- `BRIDGE_MODE`、`CCR_AUTO_CONNECT`、`CCR_MIRROR`、`CCR_REMOTE_SETUP`
  可干净捆绑，但在运行时受 claude.ai OAuth 和 GrowthBook
  授权检查的门控。
- `KAIROS_BRIEF`、`KAIROS_CHANNELS`
  可干净捆绑，但不会恢复完整的缺失助手栈。
  它们仅暴露仍然存在的简报/渠道特定界面。
- `CHICAGO_MCP`
  可干净捆绑，但运行时路径仍会访问外部化的
  `@ant/computer-use-*` 包。在外部快照中这是编译安全，
  但并非完全运行时安全。
- `TEAMMEM`
  可干净捆绑，但仅在环境中实际启用了团队记忆配置/文件时
  才执行有用的工作。

## 有简单重建路径的破损标志

以下是当前阻塞点看起来足够小，通过集中的重建工作
可能就能恢复它们，而无需重建整个子系统的失败标志。

- `AUTO_THEME`
  因缺失 `src/utils/systemThemeWatcher.js` 而失败。`systemTheme.ts` 和
  主题提供程序已经包含缓存/解析逻辑，因此缺失的部分
  看起来只是 OSC 11 观察器。
- `BG_SESSIONS`
  因缺失 `src/cli/bg.js` 而失败。`src/entrypoints/cli.tsx` 中的
  CLI 快速路径调度已经接线。
- `BUDDY`
  因缺失 `src/commands/buddy/index.js` 而失败。伙伴 UI 组件和
  提示输入钩子已经存在。
- `BUILDING_CLAUDE_APPS`
  因缺失 `src/claude-api/csharp/claude-api.md` 而失败。这看起来是
  资源/文档缺失，而非运行时子系统缺失。
- `COMMIT_ATTRIBUTION`
  因缺失 `src/utils/attributionHooks.js` 而失败。设置和缓存清除代码
  已经调用该钩子模块。
- `FORK_SUBAGENT`
  因缺失 `src/commands/fork/index.js` 而失败。命令槽和消息
  渲染支持已经存在。
- `HISTORY_SNIP`
  因缺失 `src/commands/force-snip.js` 而失败。周围的 SnipTool 和
  查询/消息注释已经存在。
- `KAIROS_GITHUB_WEBHOOKS`
  因缺失 `src/tools/SubscribePRTool/SubscribePRTool.js` 而失败。命令
  槽和部分消息处理已经存在。
- `KAIROS_PUSH_NOTIFICATION`
  因缺失 `src/tools/PushNotificationTool/PushNotificationTool.js` 而失败。
  工具槽已在 `src/tools.ts` 中存在。
- `MCP_SKILLS`
  因缺失 `src/skills/mcpSkills.js` 而失败。`mcpSkillBuilders.ts` 已经存在，
  专门用于支持该缺失的注册表层。
- `MEMORY_SHAPE_TELEMETRY`
  因缺失 `src/memdir/memoryShapeTelemetry.js` 而失败。钩子调用点
  已在 `sessionFileAccessHooks.ts` 中就位。
- `OVERFLOW_TEST_TOOL`
  因缺失 `src/tools/OverflowTestTool/OverflowTestTool.js` 而失败。
  这看起来是孤立的且仅用于测试。
- `RUN_SKILL_GENERATOR`
  因缺失 `src/runSkillGenerator.js` 而失败。捆绑的技能注册
  路径已经期望它。
- `TEMPLATES`
  因缺失 `src/cli/handlers/templateJobs.js` 而失败。CLI 快速路径
  已在 `src/entrypoints/cli.tsx` 中接线。
- `TORCH`
  因缺失 `src/commands/torch.js` 而失败。这看起来是单个命令
  入口缺失。
- `TRANSCRIPT_CLASSIFIER`
  第一个硬性失败是缺失
  `src/utils/permissions/yolo-classifier-prompts/auto_mode_system_prompt.txt`。
  分类器引擎、解析器和设置管道已经存在，因此
  缺失的提示/资产可能是第一个重建目标。

## 有部分接线但存在中等规模缺失的破损标志

这些确实有大量相关代码，但缺失的部分比单个包装器
或资源更大。

- `BYOC_ENVIRONMENT_RUNNER`
  缺失 `src/environment-runner/main.js`。
- `CONTEXT_COLLAPSE`
  缺失 `src/tools/CtxInspectTool/CtxInspectTool.js`。
- `COORDINATOR_MODE`
  缺失 `src/coordinator/workerAgent.js`。
- `DAEMON`
  缺失 `src/daemon/workerRegistry.js`。
- `DIRECT_CONNECT`
  缺失 `src/server/parseConnectUrl.js`。
- `EXPERIMENTAL_SKILL_SEARCH`
  缺失 `src/services/skillSearch/localSearch.js`。
- `MONITOR_TOOL`
  缺失 `src/tools/MonitorTool/MonitorTool.js`。
- `REACTIVE_COMPACT`
  缺失 `src/services/compact/reactiveCompact.js`。
- `REVIEW_ARTIFACT`
  缺失 `src/hunter.js`。
- `SELF_HOSTED_RUNNER`
  缺失 `src/self-hosted-runner/main.js`。
- `SSH_REMOTE`
  缺失 `src/ssh/createSSHSession.js`。
- `TERMINAL_PANEL`
  缺失 `src/tools/TerminalCaptureTool/TerminalCaptureTool.js`。
- `UDS_INBOX`
  缺失 `src/utils/udsMessaging.js`。
- `WEB_BROWSER_TOOL`
  缺失 `src/tools/WebBrowserTool/WebBrowserTool.js`。
- `WORKFLOW_SCRIPTS`
  首先在 `src/commands/workflows/index.js` 上失败，但还有更多缺失：
  `tasks.ts` 已经期望 `LocalWorkflowTask`，而 `tools.ts` 期望
  真正的 `WorkflowTool` 实现，但此快照中仅存在
  `WorkflowTool/constants.ts`。

## 有大量缺失子系统的破损标志

这些仍然看起来恢复成本很高，因为第一个缺失的导入
只是更广泛的缺失子系统的可见边缘。

- `KAIROS`
  缺失 `src/assistant/index.js` 以及大部分助手栈。
- `KAIROS_DREAM`
  缺失 `src/dream.js` 和相关梦想任务行为。
- `PROACTIVE`
  缺失 `src/proactive/index.js` 和主动任务/工具栈。

## 有用的入口点

- 功能感知构建逻辑：
  [scripts/build.ts](/Users/paolo/Repos/claude-code/scripts/build.ts)
- 功能门控命令导入：
  [src/commands.ts](/Users/paolo/Repos/claude-code/src/commands.ts)
- 功能门控工具导入：
  [src/tools.ts](/Users/paolo/Repos/claude-code/src/tools.ts)
- 功能门控任务导入：
  [src/tasks.ts](/Users/paolo/Repos/claude-code/src/tasks.ts)
- 功能门控查询行为：
  [src/query.ts](/Users/paolo/Repos/claude-code/src/query.ts)
- 功能门控 CLI 入口路径：
  [src/entrypoints/cli.tsx](/Users/paolo/Repos/claude-code/src/entrypoints/cli.tsx)