# Codex API 支持：功能对齐与 UI 重构

## 概述
本拉取请求为 OpenAI Codex 后端（`chatgpt.com/backend-api/codex/responses`）引入了完整的功能对齐和显式 UI 支持。代码库现已完全后端无关，可根据当前认证在 Anthropic Claude 和 OpenAI Codex 模式之间平滑切换，且不会丢失推理动画、Token 计费或多模态视觉输入等功能。

## 主要变更

### 1. Codex API 网关适配器（`codex-fetch-adapter.ts`）
- **原生视觉翻译**：Anthropic `base64` 图像模式现已精确映射为 Codex 期望的 `input_image` 载荷。
- **严格载荷映射**：重构了内部映射逻辑，将 `msg.content` 项精确翻译为 `input_text`，规避 OpenAI 严格的 `v1/responses` 验证规则（`Invalid value: 'text'`）。
- **工具逻辑修复**：将 `tool_result` 项正确路由至顶层 `function_call_output` 对象，确保本地 CLI 工具执行（文件读取、Bash 循环）的结果能干净地回传至 Codex 逻辑，而不会抛出"No tool output found"错误。
- **缓存剥离**：在传输前干净地剥离 Anthropic 专有的 `cache_control` 注解（来自工具绑定和提示词），避免 Codex API 拒绝格式错误的 JSON。

### 2. 深度 UI 与路由集成
- **模型清理（`model.ts`）**：更新了 `getPublicModelDisplayName` 和 `getClaudeAiUserDefaultModelDescription` 以识别 Codex GPT 字符串。`gpt-5.1-codex-max` 等模型现在在 CLI 可视化输出中优雅地映射为 `Codex 5.1 Max`，而非直接显示原始代理 ID。
- **默认路由**：使 `getDefaultMainLoopModelSetting` 感知 `isCodexSubscriber()`，自动默认使用 `gpt-5.2-codex` 而非 `sonnet46`。
- **计费视觉（`logoV2Utils.ts`）**：重构了 `formatModelAndBilling` 逻辑，在认证后于终端头部醒目渲染 `Codex API Billing`。

### 3. 推理与指标支持
- **思维动画**：`codex-fetch-adapter` 现在有意拦截 `codex-max` 模型发出的专有 `response.reasoning.delta` SSE 帧，将其包装为 Anthropic `<thinking>` 事件，确保标准 CLI 的"Thinking..."旋转指示器在 OpenAI 推理场景下依然完美运行。
- **Token 精确度**：绑定逻辑以追踪 `response.completed` 完成事件，获取 `usage.input_tokens` 和 `output_tokens`。这些数据被原生注入最终的 `message_stop` Token 处理器，意味着 Codex 查询能正确触发终端的 Token/价格追踪汇总逻辑。

### 4. Git 清理
- 配置 `.gitignore` 以安全且持久地将 `openclaw/` 网关目录排除在暂存提交之外。
