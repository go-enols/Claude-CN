import type {
  createSkillCommand,
  parseSkillFrontmatterFields,
} from './loadSkillsDir.js'

/**
 * MCP 技能发现需要的两个 loadSkillsDir 函数的写一次注册表。
 * 这个模块是依赖图的叶子：它只导入类型，因此 mcpSkills.ts 和 loadSkillsDir.ts
 * 都可以依赖它而不会形成循环（client.ts → mcpSkills.ts → loadSkillsDir.ts → …
 * → client.ts）。
 *
 * 非字面量动态导入方法（"await import(variable)"）在 Bun 打包的二进制文件中
 * 运行时失败 — 说明符针对 chunk 的 /$bunfs/root/… 路径解析，而非原始源代码树，
 * 导致"Cannot find module './loadSkillsDir.js'"。字面量动态导入在 bunfs 中有效，
 * 但 dependency-cruiser 会跟踪它，并且由于 loadSkillsDir 几乎能到达所有地方，
 * 单个新边缘在差异检查中扇出成许多新的循环冲突。
 *
 * 注册发生在 loadSkillsDir.ts 模块初始化时，通过 commands.ts 的静态导入
 * 在启动时急切求值 — 远在任何 MCP 服务器连接之前。
 */

export type MCPSkillBuilders = {
  createSkillCommand: typeof createSkillCommand
  parseSkillFrontmatterFields: typeof parseSkillFrontmatterFields
}

let builders: MCPSkillBuilders | null = null

export function registerMCPSkillBuilders(b: MCPSkillBuilders): void {
  builders = b
}

export function getMCPSkillBuilders(): MCPSkillBuilders {
  if (!builders) {
    throw new Error(
      'MCP skill 构建器未注册 — loadSkillsDir.ts 尚未被加载',
    )
  }
  return builders
}