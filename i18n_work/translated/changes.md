# Codex API 支持：功能对等与 UI 大修

## 摘要
此 Pull Request 引入了对 OpenAI Codex 后端（`chatgpt.com/backend-api/codex/responses`）的完整功能对等和显式 UI 支持。代码库现在完全与后端无关，能够根据当前认证在 Anthropic Claude 和 OpenAI Codex 模式之间平滑切换，而不会丢失推理动画、Token 计费或多模态视觉输入等功能。

## 关键变更

### 1. Codex API 网关适配器（`codex-fetch-adapter.ts`）
- **原生视觉翻译**：Anthropic 的 `base64` 图像模式现在精确映射到 Codex 期望的 `input_image` 载荷。
- **严格载荷映射**：重构了内部映射逻辑，将 `msg.content` 项精确翻译为 `input_text`，避开了 OpenAI 严格的 `v1/responses` 验证规则（`Invalid value: 'text'`）。
- **工具逻辑修复**：正确地将 `tool_result` 项路由到顶层 `function_call_output` 对象，确保本地 CLI 工具执行（文件读取、Bash 循环）能干净地反馈到 Codex 逻辑中，而不会抛出"未找到工具输出"错误。
- **缓存剥离**：在传输前干净地剥离了工具绑定和提示中的 Anthropic 专属 `cache_control` 注解，使 Codex API 不会拒绝格式错误的 JSON。

### 2. 深度 UI 与路由集成
- **模型清理（`model.ts`）**：更新了 `getPublicModelDisplayName` 和 `getClaudeAiUserDefaultModelDescription` 以识别 Codex GPT 字符串。像 `gpt-5.1-codex-max` 这样的模型现在能在 CLI 视觉输出中漂亮地映射为 `Codex 5.1 Max`，而不是传递原始代理 ID。
- **默认重路由**：使 `getDefaultMainLoopModelSetting` 能够感知 `isCodexSubscriber()`，自动默认使用 `gpt-5.2-codex` 而不是 `sonnet46`。
- **计费视觉（`logoV2Utils.ts`）**：重构了 `formatModelAndBilling` 逻辑，在认证后于终端头部自豪地显示 `Codex API 计费`。

### 3. 推理与指标支持
- **思考动画**：`codex-fetch-adapter` 现在有意拦截 `codex-max` 模型发出的专有 `response.reasoning.delta` SSE 帧。将其包装为 Anthropic 的 `<thinking>` 事件，确保标准 CLI 的"思考中..."旋转动画在 OpenAI 推理中继续完美运行。
- **Token 准确性**：绑定了逻辑以跟踪 `response.completed` 完成事件，获取 `usage.input_tokens` 和 `output_tokens`。这些数据被原生注入到最终的 `message_stop` Token 处理器中，意味着 Codex 查询能正确触发终端的 Token/价格跟踪摘要逻辑。

### 4. Git 清理
- 配置了 `.gitignore` 以安全持久地将 `openclaw/` 网关目录排除在暂存提交之外。