/**
 * 内置插件注册表
 *
 * 管理随 CLI 一起发货的内置插件，用户可以通过 /plugin UI 启用/禁用它们。
 *
 * 内置插件与捆绑技能（src/skills/bundled/）的不同之处在于：
 * - 它们出现在 /plugin UI 的"内置"部分下
 * - 用户可以启用/禁用它们（保存到用户设置中）
 * - 它们可以提供多个组件（技能、钩子、MCP 服务器）
 *
 * 插件 ID 使用 `{name}@builtin` 格式，以区别于
 * 市场插件（`{name}@{marketplace}`）。
 */

import type { Command } from '../commands.js'
import type { BundledSkillDefinition } from '../skills/bundledSkills.js'
import type { BuiltinPluginDefinition, LoadedPlugin } from '../types/plugin.js'
import { getSettings_DEPRECATED } from '../utils/settings/settings.js'

const BUILTIN_PLUGINS: Map<string, BuiltinPluginDefinition> = new Map()

export const BUILTIN_MARKETPLACE_NAME = 'builtin'

/**
 * 注册内置插件。在启动时从 initBuiltinPlugins() 调用此函数。
 */
export function registerBuiltinPlugin(
  definition: BuiltinPluginDefinition,
): void {
  BUILTIN_PLUGINS.set(definition.name, definition)
}

/**
 * 检查插件 ID 是否表示内置插件（以 @builtin 结尾）。
 */
export function isBuiltinPluginId(pluginId: string): boolean {
  return pluginId.endsWith(`@${BUILTIN_MARKETPLACE_NAME}`)
}

/**
 * 按名称获取特定的内置插件定义。
 * 这对于 /plugin UI 显示技能/钩子/MCP 列表很有用，
 * 无需进行市场查找。
 */
export function getBuiltinPluginDefinition(
  name: string,
): BuiltinPluginDefinition | undefined {
  return BUILTIN_PLUGINS.get(name)
}

/**
 * 获取所有已注册的内置插件作为 LoadedPlugin 对象，根据
 * 用户设置（以 defaultEnabled 作为后备）分为启用/禁用两类。
 * 省略 isAvailable() 返回 false 的插件。
 */
export function getBuiltinPlugins(): {
  enabled: LoadedPlugin[]
  disabled: LoadedPlugin[]
} {
  const settings = getSettings_DEPRECATED()
  const enabled: LoadedPlugin[] = []
  const disabled: LoadedPlugin[] = []

  for (const [name, definition] of BUILTIN_PLUGINS) {
    if (definition.isAvailable && !definition.isAvailable()) {
      continue
    }

    const pluginId = `${name}@${BUILTIN_MARKETPLACE_NAME}`
    const userSetting = settings?.enabledPlugins?.[pluginId]
    // 启用状态：用户偏好 > 插件默认 > true
    const isEnabled =
      userSetting !== undefined
        ? userSetting === true
        : (definition.defaultEnabled ?? true)

    const plugin: LoadedPlugin = {
      name,
      manifest: {
        name,
        description: definition.description,
        version: definition.version,
      },
      path: BUILTIN_MARKETPLACE_NAME, // 标记 — 无文件系统路径
      source: pluginId,
      repository: pluginId,
      enabled: isEnabled,
      isBuiltin: true,
      hooksConfig: definition.hooks,
      mcpServers: definition.mcpServers,
    }

    if (isEnabled) {
      enabled.push(plugin)
    } else {
      disabled.push(plugin)
    }
  }

  return { enabled, disabled }
}

/**
 * 从启用的内置插件获取作为 Command 对象的技能。
 * 不会返回来自已禁用插件的技能。
 */
export function getBuiltinPluginSkillCommands(): Command[] {
  const { enabled } = getBuiltinPlugins()
  const commands: Command[] = []

  for (const plugin of enabled) {
    const definition = BUILTIN_PLUGINS.get(plugin.name)
    if (!definition?.skills) continue
    for (const skill of definition.skills) {
      commands.push(skillDefinitionToCommand(skill))
    }
  }

  return commands
}

/**
 * 清除内置插件注册表（用于测试）。
 */
export function clearBuiltinPlugins(): void {
  BUILTIN_PLUGINS.clear()
}

// --

function skillDefinitionToCommand(definition: BundledSkillDefinition): Command {
  return {
    type: 'prompt',
    name: definition.name,
    description: definition.description,
    hasUserSpecifiedDescription: true,
    allowedTools: definition.allowedTools ?? [],
    argumentHint: definition.argumentHint,
    whenToUse: definition.whenToUse,
    model: definition.model,
    disableModelInvocation: definition.disableModelInvocation ?? false,
    userInvocable: definition.userInvocable ?? true,
    contentLength: 0,
    // 'bundled' 而非 'builtin' — Command.source 中的 'builtin' 表示硬编码
    // 斜杠命令（/help、/clear）。使用 'bundled' 使这些技能保留在
    // Skill 工具的列表、分析名称日志和提示截断豁免中。
    // 用户可切换方面在 LoadedPlugin.isBuiltin 上跟踪。
    source: 'bundled',
    loadedFrom: 'bundled',
    hooks: definition.hooks,
    context: definition.context,
    agent: definition.agent,
    isEnabled: definition.isEnabled ?? (() => true),
    isHidden: !(definition.userInvocable ?? true),
    progressMessage: 'running',
    getPromptForCommand: definition.getPromptForCommand,
  }
}