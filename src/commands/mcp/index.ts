import type { Command } from '../../commands.js'

const mcp = {
  type: 'local-jsx',
  name: 'mcp',
  description: '管理 MCP 服务器',
  immediate: true,
  argumentHint: '[enable|disable [服务器名称]]',
  load: () => import('./mcp.js'),
} satisfies Command

export default mcp

