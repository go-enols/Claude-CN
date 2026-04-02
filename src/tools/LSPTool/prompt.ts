export const LSP_TOOL_NAME = 'LSP' as const

export const DESCRIPTION = `与语言服务器协议（LSP）服务器交互以获取代码智能功能。

支持的操作：
- goToDefinition：查找符号的定义位置
- findReferences：查找符号的所有引用
- hover：获取符号的悬停信息（文档、类型信息）
- documentSymbol：获取文档中的所有符号（函数、类、变量）
- workspaceSymbol：在整个工作区中搜索符号
- goToImplementation：查找接口或抽象方法的实现
- prepareCallHierarchy：获取位置处的调用层次结构项（函数/方法）
- incomingCalls：查找调用位置处函数/方法的所有函数/方法
- outgoingCalls：查找位置处函数/方法调用的所有函数/方法

所有操作都需要：
- filePath：要操作的文件
- line：行号（1-based，如编辑器中显示）
- character：字符偏移量（1-based，如编辑器中显示）

注意：必须为文件类型配置 LSP 服务器。如果没有可用的服务器，将返回错误。`
