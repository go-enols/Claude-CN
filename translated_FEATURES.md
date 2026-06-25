# Feature Flags 审计

审计日期: 2026-03-31

当前仓库中引用了 88 个 `feature('FLAG')` 编译期标志。
我在当前的外部构建定义（external-build defines）和外部依赖（externals）的基础上，对每个标志分别打包 CLI 进行了一次重新检查。结果如下：

- 54 个标志在当前快照中可以正常打包
- 34 个标志仍然无法打包

重要提示："可以正常打包"并不总是意味着"运行时安全"。某些标志仍然依赖于可选的 native 模块、claude.ai OAuth、GrowthBook 开关或外部化的 `@ant/*` 包。

## 构建变体

- `bun run build`
  构建常规的外部二进制文件，输出到 `./cli`。
- `bun run compile`
  构建常规的外部二进制文件，输出到 `./dist/cli`。
- `bun run build:dev`
  构建 `./cli-dev`，使用开发版本标记和实验性 GrowthBook 密钥。
- `bun run build:dev:full`
  构建 `./cli-dev`，包含本文档中当前全部的"可用的实验性功能"集合，但排除 `CHICAGO_MCP`。该标志虽然可以编译，但外部二进制文件在启用它时无法正常启动，因为启动过程会触及缺失的 `@ant/computer-use-mcp` 运行时包。

## 默认构建标志

- `VOICE_MODE`
  此标志现已纳入默认构建流水线，而不仅仅是开发构建。它启用了 `/voice`、按住说话 UI、语音通知和听写管道。运行时仍然依赖 claude.ai OAuth 以及 native 音频模块或 SoX 等备用录音工具。

## 可用的实验性功能

以下列出的标志是面向用户或会改变行为、且当前可以正常打包的标志。除非明确标注为默认启用，否则在当前快照中仍应视为实验性功能。

### 交互与 UI 实验

- `AWAY_SUMMARY`
  在 REPL 中添加离开键盘摘要行为。
- `HISTORY_PICKER`
  启用交互式提示历史选择器。
- `HOOK_PROMPTS`
  将提示/请求文本传递到 hook 执行流程中。
- `KAIROS_BRIEF`
  仅启用简要版对话布局和面向 BriefTool 的用户体验，不包含完整的 assistant 栈。
- `KAIROS_CHANNELS`
  启用与 MCP/channel 消息传递相关的频道通知和频道回调管道。
- `LODESTONE`
  启用与深度链接/协议注册相关的流程和设置连接。
- `MESSAGE_ACTIONS`
  在交互式 UI 中启用消息操作入口点。
- `NEW_INIT`
  启用较新的 `/init` 决策路径。
- `QUICK_SEARCH`
  启用提示快速搜索行为。
- `SHOT_STATS`
  启用额外的 shot 分布统计视图。
- `TOKEN_BUDGET`
  启用 token 预算跟踪、提示触发器和 token 警告 UI。
- `ULTRAPLAN`
  启用 `/ultraplan`、提示触发器和退出计划功能。
- `ULTRATHINK`
  启用额外的思考深度模式切换。
- `VOICE_MODE`
  启用语音切换、听写快捷键、语音通知和语音 UI。

### Agent、记忆与规划实验

- `AGENT_MEMORY_SNAPSHOT`
  在应用中存储额外的自定义 agent 记忆快照状态。
- `AGENT_TRIGGERS`
  启用本地 cron/trigger 工具和打包的触发器相关技能。
- `AGENT_TRIGGERS_REMOTE`
  启用远程触发器工具路径。
- `BUILTIN_EXPLORE_PLAN_AGENTS`
  启用内置的 explore/plan agent 预设。
- `CACHED_MICROCOMPACT`
  在查询和 API 流程中启用缓存微压缩状态。
- `COMPACTION_REMINDERS`
  在压缩和附件流程中启用提醒文案。
- `EXTRACT_MEMORIES`
  启用查询后记忆提取 hook。
- `PROMPT_CACHE_BREAK_DETECTION`
  在压缩/查询/API 流程中启用缓存中断检测。
- `TEAMMEM`
  启用团队记忆文件、观察者 hook 及相关 UI 消息。
- `VERIFICATION_AGENT`
  在提示和 task/todo 工具中启用验证 agent 引导。

### 工具、权限与远程实验

- `BASH_CLASSIFIER`
  启用分类器辅助的 bash 权限决策。
- `BRIDGE_MODE`
  启用远程控制/REPL 桥接命令和授权路径。
- `CCR_AUTO_CONNECT`
  启用 CCR 自动连接默认路径。
- `CCR_MIRROR`
  启用仅出站的 CCR 镜像会话。
- `CCR_REMOTE_SETUP`
  启用远程设置命令路径。
- `CHICAGO_MCP`
  启用计算机使用 MCP 集成路径和包装器加载。
- `CONNECTOR_TEXT`
  在 API/日志/UI 路径中启用 connector-text 块处理。
- `MCP_RICH_OUTPUT`
  启用更丰富的 MCP UI 渲染。
- `NATIVE_CLIPBOARD_IMAGE`
  启用 native macOS 剪贴板图像的快速路径。
- `POWERSHELL_AUTO_MODE`
  启用 PowerShell 特定的自动模式权限处理。
- `TREE_SITTER_BASH`
  启用 tree-sitter bash 解析器后端。
- `TREE_SITTER_BASH_SHADOW`
  启用 tree-sitter bash 影子灰度发布路径。
- `UNATTENDED_RETRY`
  在 API 重试流程中启用无人值守重试行为。

## 可正常打包的支持型标志

以下标志也可以正常打包，但它们大多是灰度发布、平台、遥测或管道开关，而不是面向用户的实验性功能。

- `ABLATION_BASELINE`
  CLI 消融/基线入口点开关。
- `ALLOW_TEST_VERSIONS`
  允许在 native 安装器流程中使用测试版本。
- `ANTI_DISTILLATION_CC`
  添加反蒸馏请求元数据。
- `BREAK_CACHE_COMMAND`
  注入中断缓存命令路径。
- `COWORKER_TYPE_TELEMETRY`
  添加协作者类型遥测字段。
- `DOWNLOAD_USER_SETTINGS`
  启用设置同步拉取路径。
- `DUMP_SYSTEM_PROMPT`
  启用系统提示导出路径。
- `FILE_PERSISTENCE`
  启用文件持久化管道。
- `HARD_FAIL`
  启用更严格的失败/日志记录行为。
- `IS_LIBC_GLIBC`
  强制 glibc 环境检测。
- `IS_LIBC_MUSL`
  强制 musl 环境检测。
- `NATIVE_CLIENT_ATTESTATION`
  在系统标头中添加 native 证明标记文本。
- `PERFETTO_TRACING`
  启用 perfetto 追踪 hook。
- `SKILL_IMPROVEMENT`
  启用技能改进 hook。
- `SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED`
  在自动更新禁用时跳过更新检测。
- `SLOW_OPERATION_LOGGING`
  启用慢操作日志记录。
- `UPLOAD_USER_SETTINGS`
  启用设置同步推送路径。

## 编译安全但存在运行时限制

以下标志在当前可以打包，但我仍然建议将其视为实验性功能，因为它们存在重要的运行时限制：

- `VOICE_MODE`
  可以正常打包，但需要 claude.ai OAuth 和本地录音后端。native 音频模块现在是可选的；在此机器上，备用路径会提示需要 `brew install sox`。
- `NATIVE_CLIPBOARD_IMAGE`
  可以正常打包，但仅在 `image-processor-napi` 存在时才能加速 macOS 剪贴板读取。
- `BRIDGE_MODE`、`CCR_AUTO_CONNECT`、`CCR_MIRROR`、`CCR_REMOTE_SETUP`
  可以正常打包，但在运行时受 claude.ai OAuth 和 GrowthBook 授权检查的限制。
- `KAIROS_BRIEF`、`KAIROS_CHANNELS`
  可以正常打包，但它们不会恢复完整缺失的 assistant 栈，只会暴露仍然存在的 brief/channel 特定界面。
- `CHICAGO_MCP`
  可以正常打包，但运行时路径仍会触及外部化的 `@ant/computer-use-*` 包。在外部快照中，这是编译安全而非完全运行时安全。
- `TEAMMEM`
  可以正常打包，但仅在环境中实际启用了团队记忆配置/文件时才能正常工作。

## 有简单重建路径的损坏标志

以下是失败的标志，但当前的阻塞因素看起来足够小，通过一次有针对性的重建工作很可能就能恢复它们，而无需重建整个子系统。

- `AUTO_THEME`
  失败原因：缺少 `src/utils/systemThemeWatcher.js`。`systemTheme.ts` 和主题提供者已经包含了缓存/解析逻辑，因此缺失的部分看起来只是 OSC 11 观察器。
- `BG_SESSIONS`
  失败原因：缺少 `src/cli/bg.js`。`src/entrypoints/cli.tsx` 中的 CLI 快速路径分发已经连接好了。
- `BUDDY`
  失败原因：缺少 `src/commands/buddy/index.js`。Buddy UI 组件和提示输入 hook 已经存在。
- `BUILDING_CLAUDE_APPS`
  失败原因：缺少 `src/claude-api/csharp/claude-api.md`。这看起来是资产/文档缺失，而不是缺少运行时子系统。
- `COMMIT_ATTRIBUTION`
  失败原因：缺少 `src/utils/attributionHooks.js`。设置和缓存清除代码已经在调用该 hook 模块。
- `FORK_SUBAGENT`
  失败原因：缺少 `src/commands/fork/index.js`。命令槽位和消息渲染支持已经存在。
- `HISTORY_SNIP`
  失败原因：缺少 `src/commands/force-snip.js`。相关的 SnipTool 和查询/消息注释已经存在。
- `KAIROS_GITHUB_WEBHOOKS`
  失败原因：缺少 `src/tools/SubscribePRTool/SubscribePRTool.js`。命令槽位和部分消息处理已经存在。
- `KAIROS_PUSH_NOTIFICATION`
  失败原因：缺少 `src/tools/PushNotificationTool/PushNotificationTool.js`。工具槽位已存在于 `src/tools.ts` 中。
- `MCP_SKILLS`
  失败原因：缺少 `src/skills/mcpSkills.js`。`mcpSkillBuilders.ts` 已经专门为支持该缺失的注册层而存在。
- `MEMORY_SHAPE_TELEMETRY`
  失败原因：缺少 `src/memdir/memoryShapeTelemetry.js`。`sessionFileAccessHooks.ts` 中的 hook 调用点已经就位。
- `OVERFLOW_TEST_TOOL`
  失败原因：缺少 `src/tools/OverflowTestTool/OverflowTestTool.js`。这看起来是独立的且仅用于测试。
- `RUN_SKILL_GENERATOR`
  失败原因：缺少 `src/runSkillGenerator.js`。打包的技能注册路径已经期望它的存在。
- `TEMPLATES`
  失败原因：缺少 `src/cli/handlers/templateJobs.js`。CLI 快速路径已在 `src/entrypoints/cli.tsx` 中连接好了。
- `TORCH`
  失败原因：缺少 `src/commands/torch.js`。这看起来只是一个命令入口缺失。
- `TRANSCRIPT_CLASSIFIER`
  第一个硬性失败原因是缺少 `src/utils/permissions/yolo-classifier-prompts/auto_mode_system_prompt.txt`。分类器引擎、解析器和设置管道已经存在，因此缺失的提示/资产很可能是第一个重建目标。

## 损坏但有部分连接、缺失规模中等的标志

以下标志确实有重要的周边代码，但缺失的部分比单个包装器或资产更大。

- `BYOC_ENVIRONMENT_RUNNER`
  缺少 `src/environment-runner/main.js`。
- `CONTEXT_COLLAPSE`
  缺少 `src/tools/CtxInspectTool/CtxInspectTool.js`。
- `COORDINATOR_MODE`
  缺少 `src/coordinator/workerAgent.js`。
- `DAEMON`
  缺少 `src/daemon/workerRegistry.js`。
- `DIRECT_CONNECT`
  缺少 `src/server/parseConnectUrl.js`。
- `EXPERIMENTAL_SKILL_SEARCH`
  缺少 `src/services/skillSearch/localSearch.js`。
- `MONITOR_TOOL`
  缺少 `src/tools/MonitorTool/MonitorTool.js`。
- `REACTIVE_COMPACT`
  缺少 `src/services/compact/reactiveCompact.js`。
- `REVIEW_ARTIFACT`
  缺少 `src/hunter.js`。
- `SELF_HOSTED_RUNNER`
  缺少 `src/self-hosted-runner/main.js`。
- `SSH_REMOTE`
  缺少 `src/ssh/createSSHSession.js`。
- `TERMINAL_PANEL`
  缺少 `src/tools/TerminalCaptureTool/TerminalCaptureTool.js`。
- `UDS_INBOX`
  缺少 `src/utils/udsMessaging.js`。
- `WEB_BROWSER_TOOL`
  缺少 `src/tools/WebBrowserTool/WebBrowserTool.js`。
- `WORKFLOW_SCRIPTS`
  首先在 `src/commands/workflows/index.js` 处失败，但还有更多缺失：`tasks.ts` 已经期望 `LocalWorkflowTask`，`tools.ts` 期望一个真正的 `WorkflowTool` 实现，而当前快照中仅存在 `WorkflowTool/constants.ts`。

## 损坏且有大量缺失子系统的标志

以下标志恢复成本仍然很高，因为第一个缺失的导入只是更广泛缺失子系统的冰山一角。

- `KAIROS`
  缺少 `src/assistant/index.js` 以及与之相关的大部分 assistant 栈。
- `KAIROS_DREAM`
  缺少 `src/dream.js` 和相关的 dream 任务行为。
- `PROACTIVE`
  缺少 `src/proactive/index.js` 以及 proactive 任务/工具栈。

## 有用的入口点

- 功能感知的构建逻辑：
  [scripts/build.ts](/Users/paolo/Repos/claude-code/scripts/build.ts)
- 功能门控的命令导入：
  [src/commands.ts](/Users/paolo/Repos/claude-code/src/commands.ts)
- 功能门控的工具导入：
  [src/tools.ts](/Users/paolo/Repos/claude-code/src/tools.ts)
- 功能门控的任务导入：
  [src/tasks.ts](/Users/paolo/Repos/claude-code/src/tasks.ts)
- 功能门控的查询行为：
  [src/query.ts](/Users/paolo/Repos/claude-code/src/query.ts)
- 功能门控的 CLI 入口路径：
  [src/entrypoints/cli.tsx](/Users/paolo/Repos/claude-code/src/entrypoints/cli.tsx)