# Codex API 支持：功能对等与 UI 全面升级

## 摘要
此拉取请求为 OpenAI Codex 后端（`chatgpt.com/backend-api/codex/responses`）引入完整功能对等和显式 UI 支持。代码库现在完全后端无关，并根据当前认证在 Anthropic Claude 和 OpenAI Codex 模式之间平滑过渡，不会丢失推理动画、令牌计费或多模态视觉输入等功能。

## 主要更改

### 1. Codex API 网关适配器（`codex-fetch-adapter.ts`）
- **原生视觉转换**：Anthropic 的 `base64` 图像模式现在精确映射到 Codex 期望的 `input_image` 负载。
- **严格负载映射**：重构了内部映射逻辑，将 `msg.content` 项精确转换为 `input_text`，避开了 OpenAI 严格的 `v1/responses` 验证规则（`Invalid value: 'text'`）。
- **工具逻辑修复**：将 `tool_result` 项正确路由到顶级 `function_call_output` 对象，确保本地 CLI 工具执行（文件读取、Bash 循环）干净地反馈到 Codex 逻辑中，不会抛出"No tool output found"错误。
- **缓存剥离**：在传输前从工具绑定和提示中干净地剥离 Anthropic 专用的 `cache_control` 注解，使 Codex API 不会拒绝格式错误的 JSON。

### 2. 深度 UI 与路由集成
- **模型清理（`model.ts`）**：更新了 `getPublicModelDisplayName` 和 `getClaudeAiUserDefaultModelDescription` 以识别 Codex GPT 字符串。像 `gpt-5.1-codex-max` 这样的模型现在在 CLI 视觉输出中漂亮地映射到 `Codex 5.1 Max`，而不是传递原始代理 ID。
- **默认路由**：使 `getDefaultMainLoopModelSetting` 感知 `isCodexSubscriber()`，自动默认为 `gpt-5.2-codex` 而不是 `sonnet46`。
- **计费可视化（`logoV2Utils.ts`）**：重构了 `formatModelAndBilling` 逻辑，在认证时在终端标题中自豪地显示 `Codex API Billing`。

### 3. 推理与指标支持
- **思考动画**：`codex-fetch-adapter` 现在有意拦截 `codex-max` 模型发出的专有 `response.reasoning.delta` SSE 帧。它将它们包装成 Anthropic `<thinking>` 事件，确保标准 CLI 的"Thinking..."旋转器继续为 OpenAI 推理完美运行。
- **令牌准确性**：绑定逻辑以跟踪 `response.completed` 完成事件，获取 `usage.input_tokens` 和 `output_tokens`。这些被原生注入到最终的 `message_stop` 令牌处理器中，意味着 Codex 查询正确触发终端的 Token/Price 跟踪器摘要逻辑。

### 4. Git 管理
- 配置 `.gitignore` 以安全且持久地从暂存提交中排除 `openclaw/` 网关目录。
