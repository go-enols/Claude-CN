export const DESCRIPTION = `
从 MCP 服务器读取特定资源。
- server: 要读取的 MCP 服务器的名称
- uri: 要读取的资源的 URI

用法示例：
- 从服务器读取资源：\`readMcpResource({ server: "myserver", uri: "my-resource-uri" })\`
`

export const PROMPT = `
从 MCP 服务器读取特定资源，由服务器名称和资源 URI 标识。

参数：
- server（必填）：要从中读取资源的 MCP 服务器的名称
- uri（必填）：要读取的资源的 URI
`
