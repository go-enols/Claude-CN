import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../../services/analytics/index.js'
import type { LocalCommandCall } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'

export const call: LocalCommandCall = async () => {
  const config = getGlobalConfig()
  let currentMode = config.editorMode || 'normal'

  // Handle backward compatibility - treat 'emacs' as 'normal'
  if (currentMode === 'emacs') {
    currentMode = 'normal'
  }

  const newMode = currentMode === 'normal' ? 'vim' : 'normal'

  saveGlobalConfig(current => ({
    ...current,
    editorMode: newMode,
  }))

  logEvent('tengu_editor_mode_changed', {
    mode: newMode as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    source:
      'command' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })

  return {
    type: 'text',
    value: `编辑器模式已设置为 ${newMode}。${
      newMode === 'vim'
        ? '使用 Escape 键在 INSERT 和 NORMAL 模式之间切换。'
        : '使用标准（readline）键盘绑定。'
    }`,
  }
}
