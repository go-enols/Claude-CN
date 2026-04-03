import type { CommandSpec } from '../registry.js'

const alias: CommandSpec = {
  name: 'alias',
  description: '创建或列出命令别名',
  args: {
    name: 'definition',
    description: '别名定义，格式为 name=value',
    isOptional: true,
    isVariadic: true,
  },
}

export default alias
