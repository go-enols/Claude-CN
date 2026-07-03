# 功能标志审计

审计日期：2026-03-31

本仓库当前引用了 88 个 `feature('FLAG')` 编译时标志。
我在当前外部构建定义和外部依赖的基础上，通过逐个标志打包 CLI 重新检查了它们。结果如下：

- 54 个标志在此快照中可正常打包
- 34 个标志仍然无法打包

重要提示："可正常打包"并不总是意味着"运行时安全"。有些标志仍然依赖于可选的原生模块、claude.ai OAuth、GrowthBook 门控，或者已外部化的 `@ant/*` 包。

## 构建变体

- `bun run build`
  在 `./cli` 构建常规外部二进制文件。
- `bun run compile`
  在 `./dist/cli` 构建常规外部二进制文件。
- `bun run build:dev`
  构建带有开发版本标记和实验性 GrowthBook 密钥的 `./cli-dev`。
- `bun run build:dev:full`
  使用本文档中全部当前"可用实验性功能"构建 `./cli-dev`，但不包括 `CHICAGO_MCP`。该标志仍然可以编译，但外部二进制文件无法正常启动，因为启动过程会缺少 `@ant/computer-use-mcp` 运行时包。

## 默认构建标志

- `VOICE_MODE`
  此功能现已包含在默认构建流程中，而不仅仅是开发构建。
  它启用 `/voice`、按键通话 UI、语音通知和听写管道。
  运行时仍然依赖 claude.ai OAuth 以及原生音频模块或备用录音器（如 SoX）。

## 可用实验性功能

以下是面向用户或会改变行为的标志，它们当前可以正常打包，除非明确标记为默认启用，否则在此快照中仍应视为实验性功能。

### 交互与 UI 实验

- `AWAY_SUMMARY`
  在 REPL 中添加离开键盘时的摘要行为。
- `HISTORY_PICKER`
  启用交互式提示历史选择器。
- `HOOK_PROMPTS`
  将提示/请求文本传递到钩子执行流程中。
- `KAIROS_BRIEF`
  启用仅摘要的转录布局和面向 BriefTool 的用户体验，无需完整的助手技术栈。
- `KAIROS_CHANNELS`
  启用围绕 MCP/频道消息传递的频道通知和频道回调管道。
- `LODESTONE`
  启用深度链接 / 协议注册相关流程和设置连接。
- `MESSAGE_ACTIONS`
  在交互式 UI 中启用消息操作入口点。
- `NEW_INIT`
  启用更新的 `/init` 决策路径。
- `QUICK_SEARCH`
  启用提示快速搜索行为。
- `SHOT_STATS`
  启用额外的镜头分布统计视图。
- `TOKEN_BUDGET`
  启用令牌预算跟踪、提示触发器和令牌警告 UI。
- `ULTRAPLAN`
  启用 `/ultraplan`、提示触发器和退出计划功能。
- `ULTRATHINK`
  启用额外的思考深度模式切换。
- `VOICE_MODE`
  启用语音切换、听写快捷键绑定、语音通知和语音 UI。

### 代理、记忆与规划实验

- `AGENT_MEMORY_SNAPSHOT`
  在应用中存储额外的自定义代理内存快照状态。
- `AGENT_TRIGGERS`
  启用本地 cron/触发器工具和捆绑的触发器相关技能。
- `AGENT_TRIGGERS_REMOTE`
  启用远程触发器工具路径。
- `BUILTIN_EXPLORE_PLAN_AGENTS`
  启用内置的探索/规划代理预设。
- `CACHED_MICROCOMPACT`
  通过查询和 API 流程启用缓存的微压缩状态。
- `COMPACTION_REMINDERS`
  启用围绕压缩和附件流程的提醒文案。
- `EXTRACT_MEMORIES`
  启用查询后记忆提取钩子。
- `PROMPT_CACHE_BREAK_DETECTION`
  启用围绕压缩/查询/API 流程的缓存中断检测。
- `TEAMMEM`
  启用团队记忆文件、监视器钩子和相关 UI 消息。
- `VERIFICATION_AGENT`
  在提示和任务/待办工具中启用验证代理指导。

### 工具、权限与远程实验

- `BASH_CLASSIFIER`
  启用分类器辅助的 bash 权限决策。
- `BRIDGE_MODE`
  启用远程控制 / REPL 桥接命令和授权路径。
- `CCR_AUTO_CONNECT`
  启用 CCR 自动连接默认路径。
- `CCR_MIRROR`
  启用仅出站的 CCR 镜像会话。
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
  启用 tree-sitter bash 影子推出路径。
- `UNATTENDED_RETRY`
  在 API 重试流程中启用无人值守重试行为。

## 可正常打包的支持标志

这些也可以正常打包，但它们主要是推出、平台、遥测或管道开关，而非面向用户的实验性功能。

- `ABLATION_BASELINE`
  CLI 消融/基线入口点开关。
- `ALLOW_TEST_VERSIONS`
  在原生安装流程中允许测试版本。
- `ANTI_DISTILLATION_CC`
  添加反蒸馏请求元数据。
- `BREAK_CACHE_COMMAND`
  注入中断缓存命令路径。
- `COWORKER_TYPE_TELEMETRY`
  添加协作者类型遥测字段。
- `DOWNLOAD_USER_SETTINGS`
  启用设置同步拉取路径。
- `DUMP_SYSTEM_PROMPT`
  启用系统提示转储路径。
- `FILE_PERSISTENCE`
  启用文件持久化管道。
- `HARD_FAIL`
  启用更严格的失败/日志记录行为。
- `IS_LIBC_GLIBC`
  强制 glibc 环境检测。
- `IS_LIBC_MUSL`
  强制 musl 环境检测。
- `NATIVE_CLIENT_ATTESTATION`
  在系统头中添加原生证明标记文本。
- `PERFETTO_TRACING`
  启用 perfetto 追踪钩子。
- `SKILL_IMPROVEMENT`
  启用技能改进钩子。
- `SKIP_DETECTION_WHEN_AUTOUPDATES_DISABLED`
  当自动更新禁用时跳过更新检测。
- `SLOW_OPERATION_LOGGING`
  启用慢操作日志记录。
- `UPLOAD_USER_SETTINGS`
  启用设置同步推送路径。

## 编译安全但运行时有条件限制

这些目前可以打包，但我仍将其视为实验性的，因为它们存在重要的运行时注意事项：

- `VOICE_MODE`
  可正常打包，但需要 claude.ai OAuth 和本地录音后端。
  原生音频模块现在是可选的；在这台机器上，备用路径需要 `brew install sox`。
- `NATIVE_CLIPBOARD_IMAGE`
  可正常打包，但仅在存在 `image-processor-napi` 时加速 macOS 剪贴板读取。
- `BRIDGE_MODE`、`CCR_AUTO_CONNECT`、`CCR_MIRROR`、`CCR_REMOTE_SETUP`
  可正常打包，但在运行时受 claude.ai OAuth 和 GrowthBook 授权检查门控。
- `KAIROS_BRIEF`、`KAIROS_CHANNELS`
  可正常打包，但它们不会恢复完整的缺失助手技术栈。
  它们仅暴露仍然存在的摘要/频道特定界面。
- `CHICAGO_MCP`
  可正常打包，但运行时路径仍然会访问已外部化的 `@ant/computer-use-*` 包。在外部快照中，这是编译安全的，而非完全运行时安全的。
- `TEAMMEM`
  可正常打包，但仅当环境中实际启用了团队记忆配置/文件时才会发挥作用。

## 具有简单重构路径的损坏标志

这些是失败的标志，当前的障碍看起来足够小，只需进行一次专注的重构工作就可能恢复它们，而无需重建整个子系统。

- `AUTO_THEME`
  因缺少 `src/utils/systemThemeWatcher.js` 而失败。`systemTheme.ts` 和主题提供器已经包含缓存/解析逻辑，因此缺少的部分看起来只是 OSC 11 监视器。
- `BG_SESSIONS`
  因缺少 `src/cli/bg.js` 而失败。`src/entrypoints/cli.tsx` 中的 CLI 快速路径调度已经连接。
- `BUDDY`
  因缺少 `src/commands/buddy/index.js` 而失败。伙伴 UI 组件和提示输入钩子已经存在。
- `BUILDING_CLAUDE_APPS`
  因缺少 `src/claude-api/csharp/claude-api.md` 而失败。这看起来像是资源/文档差距，而非缺失的运行时子系统。
- `COMMIT_ATTRIBUTION`
  因缺少 `src/utils/attributionHooks.js` 而失败。设置和缓存清除代码已经调用该钩子模块。
- `FORK_SUBAGENT`
  因缺少 `src/commands/fork/index.js` 而失败。命令槽和消息渲染支持已经存在。
- `HISTORY_SNIP`
  因缺少 `src/commands/force-snip.js` 而失败。周围的 SnipTool 和查询/消息注释已经存在。
- `KAIROS_GITHUB_WEBHOOKS`
  因缺少 `src/tools/SubscribePRTool/SubscribePRTool.js` 而失败。命令槽和一些消息处理已经存在。
- `KAIROS_PUSH_NOTIFICATION`
  因缺少 `src/tools/PushNotificationTool/PushNotificationTool.js` 而失败。工具槽已存在于 `src/tools.ts` 中。
- `MCP_SKILLS`
  因缺少 `src/skills/mcpSkills.js` 而失败。`mcpSkillBuilders.ts` 已经存在，专门用于支持那个缺失的注册层。
- `MEMORY_SHAPE_TELEMETRY`
  因缺少 `src/memdir/memoryShapeTelemetry.js` 而失败。钩子调用点已在 `sessionFileAccessHooks.ts` 中就位。
- `OVERFLOW_TEST_TOOL`
  因缺少 `src/tools/OverflowTestTool/OverflowTestTool.js` 而失败。这看起来是独立的，且仅用于测试。
- `RUN_Skill_GENERATOR`
  因缺少 `src/runSkillGenerator.js` 而失败。捆绑的技能注册路径已经预期它的存在。
- `TEMPLATES`
  因缺少 `src/cli/handlers/templateJobs.js` 而失败。CLI 快速路径已在 `src/entrypoints/cli.tsx` 中连接。
- `TORCH`
  因缺少 `src/commands/torch.js` 而失败。这看起来像是单个命令入口缺口。
- `TRANSCRIPT_CLASSIFIER`
  第一个硬故障是缺少 `src/utils/permissions/yolo-classifier-prompts/auto_mode_system_prompt.txt`。分类器引擎、解析器和设置管道已经存在，因此缺失的提示/资源可能是第一个重构目标。

## 具有部分连接但中等规模缺口的损坏标志

这些确实有大量周围的代码，但缺失的部分比单个包装器或资源要大。

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
  首先因 `src/commands/workflows/index.js` 而失败，但还有更多缺口：
  `tasks.ts` 已经预期 `LocalWorkflowTask`，`tools.ts` 预期一个真正的 `WorkflowTool` 实现，而此快照中仅存在 `WorkflowTool/constants.ts`。

## 存在大量缺失子系统的损坏标志

这些标志看起来恢复成本仍然很高，因为第一个缺失的导入只是一个更广泛的缺失子系统的可见边缘。

- `KAIROS`
  缺少 `src/assistant/index.js` 以及大部分助手技术栈。
- `KAIROS_DREAM`
  缺少 `src/dream.js` 和相关的梦境任务行为。
- `PROACTIVE`
  缺少 `src/proactive/index.js` 和主动任务/工具技术栈。

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
