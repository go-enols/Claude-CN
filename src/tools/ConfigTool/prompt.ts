import { feature } from 'bun:bundle'
import { getModelOptions } from '../../utils/model/modelOptions.js'
import { isVoiceGrowthBookEnabled } from '../../voice/voiceModeEnabled.js'
import {
  getOptionsForSetting,
  SUPPORTED_SETTINGS,
} from './supportedSettings.js'

export const DESCRIPTION = '获取或设置 Claude Code 配置设置。'

/**
 * Generate the prompt documentation from the registry
 */
export function generatePrompt(): string {
  const globalSettings: string[] = []
  const projectSettings: string[] = []

  for (const [key, config] of Object.entries(SUPPORTED_SETTINGS)) {
    // Skip model - it gets its own section with dynamic options
    if (key === 'model') continue
    // Voice settings are registered at build-time but gated by GrowthBook
    // at runtime. Hide from model prompt when the kill-switch is on.
    if (
      feature('VOICE_MODE') &&
      key === 'voiceEnabled' &&
      !isVoiceGrowthBookEnabled()
    )
      continue

    const options = getOptionsForSetting(key)
    let line = `- ${key}`

    if (options) {
      line += `: ${options.map(o => `"${o}"`).join(', ')}`
    } else if (config.type === 'boolean') {
      line += `: true/false`
    }

    line += ` - ${config.description}`

    if (config.source === 'global') {
      globalSettings.push(line)
    } else {
      projectSettings.push(line)
    }
  }

  const modelSection = generateModelSection()

  return `获取或设置 Claude Code 配置设置。

  查看或更改 Claude Code 设置。在用户请求配置更改、询问当前设置或调整设置对他们有益时使用。


## 用法
- **获取当前值：** 省略 "value" 参数
- **设置新值：** 包含 "value" 参数

## 可配置设置列表
以下设置可供您更改：

### 全局设置（存储在 ~/.claude.json）
${globalSettings.join('\n')}

### 项目设置（存储在 settings.json）
${projectSettings.join('\n')}

${modelSection}
## 示例
- 获取主题：{ "setting": "theme" }
- 设置深色主题：{ "setting": "theme", "value": "dark" }
- 启用 vim 模式：{ "setting": "editorMode", "value": "vim" }
- 启用详细模式：{ "setting": "verbose", "value": true }
- 更改模型：{ "setting": "model", "value": "opus" }
- 更改权限模式：{ "setting": "permissions.defaultMode", "value": "plan" }
`
}

function generateModelSection(): string {
  try {
    const options = getModelOptions()
    const lines = options.map(o => {
      const value = o.value === null ? 'null/"default"' : `"${o.value}"`
      return `  - ${value}: ${o.descriptionForModel ?? o.description}`
    })
    return `## 模型
- model - 覆盖默认模型。可用选项：
${lines.join('\n')}`
  } catch {
    return `## 模型
- model - 覆盖默认模型（sonnet、opus、haiku、best 或完整模型 ID）`
  }
}
