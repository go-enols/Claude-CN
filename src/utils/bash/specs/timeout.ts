import type { CommandSpec } from '../registry.js'

const timeout: CommandSpec = {
  name: 'timeout',
  description: '在时间限制内运行命令',
  args: [
    {
      name: 'duration',
      description: '超时前等待时长（如 10、5s、2m）',
      isOptional: false,
    },
    {
      name: 'command',
      description: '要运行的命令',
      isCommand: true,
    },
  ],
}

export default timeout
