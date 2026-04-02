/**
 * 内置插件初始化
 *
 * 初始化随 CLI 一起发货的内置插件，这些插件显示在
 * /plugin UI 中供用户启用/禁用。
 *
 * 并非所有捆绑功能都应该是内置插件 — 将此用于
 * 用户应该能够明确启用/禁用的功能。对于
 * 具有复杂设置或自动启用逻辑的功能（例如
 * claude-in-chrome），请改用 src/skills/bundled/。
 *
 * 添加新的内置插件：
 * 1. 从 '../builtinPlugins.js' 导入 registerBuiltinPlugin
 * 2. 在此处使用插件定义调用 registerBuiltinPlugin()
 */

/**
 * 初始化内置插件。在 CLI 启动期间调用。
 */
export function initBuiltinPlugins(): void {
  // 尚未注册内置插件 — 这是迁移应为用户可切换的
  // 捆绑技能的脚手架。
}