import type { CommandSpec } from '../registry.js'

const srun: CommandSpec = {
  name: 'srun',
  description: '在 SLURM 集群节点上运行命令',
  options: [
    {
      name: ['-n', '--ntasks'],
      description: '任务数量',
      args: {
        name: 'count',
        description: '要运行的任务数量',
      },
    },
    {
      name: ['-N', '--nodes'],
      description: '节点数量',
      args: {
        name: 'count',
        description: '要分配的节点数量',
      },
    },
  ],
  args: {
    name: 'command',
    description: '在集群上运行的命令',
    isCommand: true,
  },
}

export default srun
