import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command } from '../commands.js'
import type { ToolUseContext } from '../Tool.js'

type Options = {
  name: string
  description: string
  progressMessage: string
  pluginName: string
  pluginCommand: string
  /**
   * The prompt to use while the marketplace is private.
   * External users will get this prompt. Once the marketplace is public,
   * this parameter and the fallback logic can be removed.
   */
  getPromptWhileMarketplaceIsPrivate: (
    args: string,
    context: ToolUseContext,
  ) => Promise<ContentBlockParam[]>
}

export function createMovedToPluginCommand({
  name,
  description,
  progressMessage,
  pluginName,
  pluginCommand,
  getPromptWhileMarketplaceIsPrivate,
}: Options): Command {
  return {
    type: 'prompt',
    name,
    description,
    progressMessage,
    contentLength: 0, // Dynamic content
    userFacingName() {
      return name
    },
    source: 'builtin',
    async getPromptForCommand(
      args: string,
      context: ToolUseContext,
    ): Promise<ContentBlockParam[]> {
      if (process.env.USER_TYPE === 'ant') {
        return [
          {
            type: 'text',
            text: `此命令已移至插件。请告诉用户：

1. 要安装该插件，请运行：
   claude plugin install ${pluginName}@claude-code-marketplace

2. 安装后，使用 /${pluginName}:${pluginCommand} 来运行此命令

3. 有关更多信息，请参阅：https://github.com/anthropics/claude-code-marketplace/blob/main/${pluginName}/README.md

请勿尝试运行该命令。只需向用户说明插件安装步骤即可。`,
          },
        ]
      }

      return getPromptWhileMarketplaceIsPrivate(args, context)
    },
  }
}
