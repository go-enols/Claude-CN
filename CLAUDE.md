# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 汉化指南 (Localization Guide)

**汉化策略**: 采用硬编码方式直接替换用户可见字符串，不使用 i18n 框架。
**要求**：你必须真实的检查每一个文件，如果改文件不需要汉化，你必须在文件末尾增加一个换行
**如何检查进度**： 使用git status获取变更的文件数量与项目文件数量做对比
**禁止做**：禁止捏造事实，禁止需要汉化时不汉化，禁止只检查部分文件而不检查所有文件就猜猜完成了

### 汉化范围

- **需要汉化**: 终端 UI 文案、命令描述/帮助文本、错误提示、状态消息、Spinner 文案、对话框文本、命令输出
- **不要汉化**: 变量名、函数名、类名、文件路径、API 密钥/模型 ID、环境变量名、agent 系统提示词（`src/constants/prompts.ts`、`src/constants/systemPromptSections.ts`）、工具定义中的 `name` 字段、任何影响代码逻辑的字符串
