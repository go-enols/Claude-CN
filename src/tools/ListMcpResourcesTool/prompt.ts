export const LIST_MCP_RESOURCES_TOOL_NAME = 'ListMcpResourcesTool'

export const DESCRIPTION = `
列出已配置的 MCP 服务器中的可用资源。
每个资源对象都包含一个 'server' 字段，指示它来自哪个服务器。

用法示例：
- 列出所有服务器的所有资源：\`listMcpResources\`
- 列出特定服务器的资源：\`listMcpResources({ server: "myserver" })\`
`

export const PROMPT = `
列出已配置的 MCP 服务器中的可用资源。
每个返回的资源将包含所有标准 MCP 资源字段以及一个 'server' 字段，
指示该资源属于哪个服务器。

参数：
- server（可选）：要获取资源的特定 MCP 服务器的名称。如果未提供，
  将返回所有服务器的資源。
`
