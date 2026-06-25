---
# Codex API 支持：功能对齐与 UI 全面改进

## 摘要
本 Pull Request 为 OpenAI Codex 后端（`chatgpt.com/backend-api/codex/responses`）引入了完整的功能对齐和显式的 UI 支持。代码库现已完全实现后端无关化，能够根据当前认证状态在 Anthropic Claude 和 OpenAI Codex 模式之间平滑切换，同时不会丢失推理动画、Token 计费或多模态视觉输入等功能。

## 主要变更

### 1. Codex API 网关适配器（`codex-fetch-adapter.ts`）
- **原生视觉翻译**：Anthropic 的 `base64` 图像模式现已精确映射为 Codex 所需的 `input_image` 负载。
- **严格的负载映射**：重构了内部映射逻辑，将 `msg.content` 项精确翻译为 `input_text`，绕过了 OpenAI 严格的 `v1/responses` 验证规则（`Invalid value: 'text'`）。
- **工具逻辑修复**：正确地将 `tool_result` 项路由到顶层 `function_call_output` 对象中，确保本地 CLI 工具执行（File Reads、Bash 循环）能够干净地反馈到 Codex 逻辑中，而不会抛出 "No tool output found" 错误。
- **缓存剥离**：在传输前彻底清除工具绑定和提示中的 Anthropic 专属 `cache_control` 注解，防止 Codex API 拒绝格式错误的 JSON。

### 2. 深度 UI 与路由集成
- **模型清理（`model.ts`）**：更新了 `getPublicModelDisplayName` 和 `getClaudeAiUserDefaultModelDescription`，使其能识别 Codex GPT 字符串。像 `gpt-5.1-codex-max` 这样的模型现在可以在 CLI 可视化输出中优雅地显示为 `Codex 5.1 Max`，而不是传递原始的代理 ID。
- **默认路由重定向**：使 `getDefaultMainLoopModelSetting` 能够感知 `isCodexSubscriber()`，在认证通过时自动将默认模型设为 `gpt-5.2-codex` 而非 `sonnet46`。
- **计费视觉（`logoV2Utils.ts`）**：重构了 `formatModelAndBilling` 逻辑，在认证通过后，在终端头部自豪地渲染 `Codex API Billing`。

### 3. 推理与指标支持
- **思考动画**：`codex-fetch-adapter` 现在有意拦截 `codex-max` 模型发出的专有 `response.reasoning.delta` SSE 帧。它将这些帧包装为 Anthropic 的 `<thinking>` 事件，确保标准 CLI 的 "Thinking..." 旋转动画在 OpenAI 推理过程中依然能够完美运行。
- **Token 精度**：绑定了跟踪 `response.completed` 完成事件的逻辑，获取 `usage.input_tokens` 和 `output_tokens`。这些数据被原生注入到最终的 `message_stop` Token 处理器中，这意味着 Codex 查询能够正确触发终端的 Token/价格追踪摘要逻辑。

### 4. Git 管理
- 配置了 `.gitignore`，以安全且持久地将 `openclaw/` 网关目录排除在暂存提交之外。