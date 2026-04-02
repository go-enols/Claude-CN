import type { LspServerConfig } from '../services/lsp/types.js'
import type { McpServerConfig } from '../services/mcp/types.js'
import type { BundledSkillDefinition } from '../skills/bundledSkills.js'
import type {
  CommandMetadata,
  PluginAuthor,
  PluginManifest,
} from '../utils/plugins/schemas.js'
import type { HooksSettings } from '../utils/settings/types.js'

export type { PluginAuthor, PluginManifest, CommandMetadata }

/**
 * 与 CLI 一起发货的内置插件定义。
 * 内置插件出现在 /plugin UI 中，可以由用户启用/禁用
 *（持久化到用户设置）。
 */
export type BuiltinPluginDefinition = {
  /** 插件名称（用于 `{name}@builtin` 标识符） */
  name: string
  /** 在 /plugin UI 中显示的描述 */
  description: string
  /** 可选版本字符串 */
  version?: string
  /** 此插件提供的技能 */
  skills?: BundledSkillDefinition[]
  /** 此插件提供的 Hooks */
  hooks?: HooksSettings
  /** 此插件提供的 MCP 服务器 */
  mcpServers?: Record<string, McpServerConfig>
  /** 此插件是否可用（例如，基于系统能力）。不可用的插件完全隐藏。 */
  isAvailable?: () => boolean
  /** 用户设置偏好之前的默认启用状态（默认为 true） */
  defaultEnabled?: boolean
}

export type PluginRepository = {
  url: string
  branch: string
  lastUpdated?: string
  commitSha?: string
}

export type PluginConfig = {
  repositories: Record<string, PluginRepository>
}

export type LoadedPlugin = {
  name: string
  manifest: PluginManifest
  path: string
  source: string
  repository: string // 仓库标识符，通常与 source 相同
  enabled?: boolean
  isBuiltin?: boolean // CLI 随附的内置插件为 true
  sha?: string // 用于版本固定的 Git 提交 SHA（来自市场条目源）
  commandsPath?: string
  commandsPaths?: string[] // 来自清单的其他命令路径
  commandsMetadata?: Record<string, CommandMetadata> // 来自对象映射格式的命名命令的元数据
  agentsPath?: string
  agentsPaths?: string[] // 来自清单的其他代理路径
  skillsPath?: string
  skillsPaths?: string[] // 来自清单的其他技能路径
  outputStylesPath?: string
  outputStylesPaths?: string[] // 来自清单的其他输出样式路径
  hooksConfig?: HooksSettings
  mcpServers?: Record<string, McpServerConfig>
  lspServers?: Record<string, LspServerConfig>
  settings?: Record<string, unknown>
}

export type PluginComponent =
  | 'commands'
  | 'agents'
  | 'skills'
  | 'hooks'
  | 'output-styles'

/**
 * 插件错误类型的区分联合。
 * 每种错误类型都有特定的上下文数据，以便更好地调试和指导用户。
 *
 * 这用类型安全的错误处理替换了之前基于字符串的错误匹配方法，
 * 这样当错误消息改变时不会出问题。
 *
 * 实现状态：
 * 目前在生产中使用（2 种类型）：
 * - generic-error：用于各种插件加载失败
 * - plugin-not-found：用于在市场中未找到插件
 *
 * 计划将来使用（10 种类型 - 见 pluginLoader.ts 中的 TODO）：
 * - path-not-found, git-auth-failed, git-timeout, network-error
 * - manifest-parse-error, manifest-validation-error
 * - marketplace-not-found, marketplace-load-failed
 * - mcp-config-invalid, hook-load-failed, component-load-failed
 *
 * 这些未使用的类型支持 UI 格式化，并提供了改进错误特异性的清晰路线图。
 * 可以在创建错误站点被重构时逐步实现。
 */
export type PluginError =
  | {
      type: 'path-not-found'
      source: string
      plugin?: string
      path: string
      component: PluginComponent
    }
  | {
      type: 'git-auth-failed'
      source: string
      plugin?: string
      gitUrl: string
      authType: 'ssh' | 'https'
    }
  | {
      type: 'git-timeout'
      source: string
      plugin?: string
      gitUrl: string
      operation: 'clone' | 'pull'
    }
  | {
      type: 'network-error'
      source: string
      plugin?: string
      url: string
      details?: string
    }
  | {
      type: 'manifest-parse-error'
      source: string
      plugin?: string
      manifestPath: string
      parseError: string
    }
  | {
      type: 'manifest-validation-error'
      source: string
      plugin?: string
      manifestPath: string
      validationErrors: string[]
    }
  | {
      type: 'plugin-not-found'
      source: string
      pluginId: string
      marketplace: string
    }
  | {
      type: 'marketplace-not-found'
      source: string
      marketplace: string
      availableMarketplaces: string[]
    }
  | {
      type: 'marketplace-load-failed'
      source: string
      marketplace: string
      reason: string
    }
  | {
      type: 'mcp-config-invalid'
      source: string
      plugin: string
      serverName: string
      validationError: string
    }
  | {
      type: 'mcp-server-suppressed-duplicate'
      source: string
      plugin: string
      serverName: string
      duplicateOf: string
    }
  | {
      type: 'lsp-config-invalid'
      source: string
      plugin: string
      serverName: string
      validationError: string
    }
  | {
      type: 'hook-load-failed'
      source: string
      plugin: string
      hookPath: string
      reason: string
    }
  | {
      type: 'component-load-failed'
      source: string
      plugin: string
      component: PluginComponent
      path: string
      reason: string
    }
  | {
      type: 'mcpb-download-failed'
      source: string
      plugin: string
      url: string
      reason: string
    }
  | {
      type: 'mcpb-extract-failed'
      source: string
      plugin: string
      mcpbPath: string
      reason: string
    }
  | {
      type: 'mcpb-invalid-manifest'
      source: string
      plugin: string
      mcpbPath: string
      validationError: string
    }
  | {
      type: 'lsp-config-invalid'
      source: string
      plugin: string
      serverName: string
      validationError: string
    }
  | {
      type: 'lsp-server-start-failed'
      source: string
      plugin: string
      serverName: string
      reason: string
    }
  | {
      type: 'lsp-server-crashed'
      source: string
      plugin: string
      serverName: string
      exitCode: number | null
      signal?: string
    }
  | {
      type: 'lsp-request-timeout'
      source: string
      plugin: string
      serverName: string
      method: string
      timeoutMs: number
    }
  | {
      type: 'lsp-request-failed'
      source: string
      plugin: string
      serverName: string
      method: string
      error: string
    }
  | {
      type: 'marketplace-blocked-by-policy'
      source: string
      plugin?: string
      marketplace: string
      blockedByBlocklist?: boolean // 如果被 blockedMarketplaces 阻止则为 true，如果不在 strictKnownMarketplaces 中则为 false
      allowedSources: string[] // 格式化的源字符串（例如，"github:owner/repo"）
    }
  | {
      type: 'dependency-unsatisfied'
      source: string
      plugin: string
      dependency: string
      reason: 'not-enabled' | 'not-found'
    }
  | {
      type: 'plugin-cache-miss'
      source: string
      plugin: string
      installPath: string
    }
  | {
      type: 'generic-error'
      source: string
      plugin?: string
      error: string
    }

export type PluginLoadResult = {
  enabled: LoadedPlugin[]
  disabled: LoadedPlugin[]
  errors: PluginError[]
}

/**
 * 帮助函数，从任何 PluginError 获取显示消息
 * 用于日志记录和简单的错误显示
 */
export function getPluginErrorMessage(error: PluginError): string {
  switch (error.type) {
    case 'generic-error':
      return error.error
    case 'path-not-found':
      return `路径未找到：${error.path}（${error.component}）`
    case 'git-auth-failed':
      return `Git 认证失败（${error.authType}）：${error.gitUrl}`
    case 'git-timeout':
      return `Git ${error.operation} 超时：${error.gitUrl}`
    case 'network-error':
      return `网络错误：${error.url}${error.details ? ` - ${error.details}` : ''}`
    case 'manifest-parse-error':
      return `清单解析错误：${error.parseError}`
    case 'manifest-validation-error':
      return `清单验证失败：${error.validationErrors.join('，')}`
    case 'plugin-not-found':
      return `插件 ${error.pluginId} 在市场 ${error.marketplace} 中未找到`
    case 'marketplace-not-found':
      return `市场 ${error.marketplace} 未找到`
    case 'marketplace-load-failed':
      return `市场 ${error.marketplace} 加载失败：${error.reason}`
    case 'mcp-config-invalid':
      return `MCP 服务器 ${error.serverName} 无效：${error.validationError}`
    case 'mcp-server-suppressed-duplicate': {
      const dup = error.duplicateOf.startsWith('plugin:')
        ? `由插件 "${error.duplicateOf.split(':')[1] ?? '?'}" 提供的服务器`
        : `已配置的 "${error.duplicateOf}"`
      return `MCP 服务器 "${error.serverName}" 已跳过 — 与 ${dup} 的命令/URL 相同`
    }
    case 'hook-load-failed':
      return `Hook 加载失败：${error.reason}`
    case 'component-load-failed':
      return `${error.component} 从 ${error.path} 加载失败：${error.reason}`
    case 'mcpb-download-failed':
      return `从 ${error.url} 下载 MCPB 失败：${error.reason}`
    case 'mcpb-extract-failed':
      return `解压 MCPB ${error.mcpbPath} 失败：${error.reason}`
    case 'mcpb-invalid-manifest':
      return `${error.mcpbPath} 处的 MCPB 清单无效：${error.validationError}`
    case 'lsp-config-invalid':
      return `插件 "${error.plugin}" 的 LSP 服务器 "${error.serverName}" 配置无效：${error.validationError}`
    case 'lsp-server-start-failed':
      return `插件 "${error.plugin}" 启动 LSP 服务器 "${error.serverName}" 失败：${error.reason}`
    case 'lsp-server-crashed':
      if (error.signal) {
        return `插件 "${error.plugin}" 的 LSP 服务器 "${error.serverName}" 崩溃，信号为 ${error.signal}`
      }
      return `插件 "${error.plugin}" 的 LSP 服务器 "${error.serverName}" 崩溃，退出码为 ${error.exitCode ?? 'unknown'}`
    case 'lsp-request-timeout':
      return `插件 "${error.plugin}" 的 LSP 服务器 "${error.serverName}" 在 ${error.method} 请求超时后（${error.timeoutMs}ms）`
    case 'lsp-request-failed':
      return `插件 "${error.plugin}" 的 LSP 服务器 "${error.serverName}" ${error.method} 请求失败：${error.error}`
    case 'marketplace-blocked-by-policy':
      if (error.blockedByBlocklist) {
        return `市场 '${error.marketplace}' 被企业策略阻止`
      }
      return `市场 '${error.marketplace}' 不在允许的市场列表中`
    case 'dependency-unsatisfied': {
      const hint =
        error.reason === 'not-enabled'
          ? '已禁用 — 启用它或移除依赖项'
          : '在任何已配置的市场中都未找到'
      return `依赖项 "${error.dependency}" ${hint}`
    }
    case 'plugin-cache-miss':
      return `插件 "${error.plugin}" 未缓存在 ${error.installPath} — 运行 /plugins 刷新`
  }
}
