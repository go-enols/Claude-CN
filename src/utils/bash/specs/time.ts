import type { CommandSpec } from '../registry.js'

const time: CommandSpec = {
  name: 'time',
  description: '为命令计时',
  args: {
    name: 'command',
    description: '要计时的命令',
    isCommand: true,
  },
}

export default time
