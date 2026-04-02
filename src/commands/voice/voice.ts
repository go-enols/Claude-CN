import { normalizeLanguageForSTT } from '../../hooks/useVoice.js'
import { getShortcutDisplay } from '../../keybindings/shortcutFormat.js'
import { logEvent } from '../../services/analytics/index.js'
import type { LocalCommandCall } from '../../types/command.js'
import { isAnthropicAuthEnabled } from '../../utils/auth.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'
import { settingsChangeDetector } from '../../utils/settings/changeDetector.js'
import {
  getInitialSettings,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'
import { isVoiceModeEnabled } from '../../voice/voiceModeEnabled.js'

const LANG_HINT_MAX_SHOWS = 2

export const call: LocalCommandCall = async () => {
  // Check auth and kill-switch before allowing voice mode
  if (!isVoiceModeEnabled()) {
    // Differentiate: OAuth-less users get an auth hint, everyone else
    // gets nothing (command shouldn't be reachable when the kill-switch is on).
    if (!isAnthropicAuthEnabled()) {
      return {
        type: 'text' as const,
        value:
          '语音模式需要 Claude.ai 账户。请运行 /login 登录。',
      }
    }
    return {
      type: 'text' as const,
      value: '语音模式不可用。',
    }
  }

  const currentSettings = getInitialSettings()
  const isCurrentlyEnabled = currentSettings.voiceEnabled === true

  // Toggle OFF — no checks needed
  if (isCurrentlyEnabled) {
    const result = updateSettingsForSource('userSettings', {
      voiceEnabled: false,
    })
    if (result.error) {
      return {
        type: 'text' as const,
        value:
          '更新设置失败。请检查设置文件是否有语法错误。',
      }
    }
    settingsChangeDetector.notifyChange('userSettings')
    logEvent('tengu_voice_toggled', { enabled: false })
    return {
      type: 'text' as const,
      value: '语音模式已禁用。',
    }
  }

  // Toggle ON — run pre-flight checks first
  const { isVoiceStreamAvailable } = await import(
    '../../services/voiceStreamSTT.js'
  )
  const { checkRecordingAvailability } = await import('../../services/voice.js')

  // Check recording availability (microphone access)
  const recording = await checkRecordingAvailability()
  if (!recording.available) {
    return {
      type: 'text' as const,
      value:
        recording.reason ?? '语音模式在此环境中不可用。',
    }
  }

  // Check for API key
  if (!isVoiceStreamAvailable()) {
    return {
      type: 'text' as const,
        value:
          '语音模式需要 Claude.ai 账户。请运行 /login 登录。',
      }
  }

  // Check for recording tools
  const { checkVoiceDependencies, requestMicrophonePermission } = await import(
    '../../services/voice.js'
  )
  const deps = await checkVoiceDependencies()
  if (!deps.available) {
    const hint = deps.installCommand
      ? `\n是否安装音频录制工具？运行：${deps.installCommand}`
      : '\n请手动安装 SoX 以进行音频录制。'
    return {
      type: 'text' as const,
      value: `未找到音频录制工具。${hint}`,
    }
  }

  // Probe mic access so the OS permission dialog fires now rather than
  // on the user's first hold-to-talk activation.
  if (!(await requestMicrophonePermission())) {
    let guidance: string
    if (process.platform === 'win32') {
      guidance = 'Settings \u2192 Privacy \u2192 Microphone'
    } else if (process.platform === 'linux') {
      guidance = "your system's audio settings"
    } else {
      guidance = 'System Settings \u2192 Privacy & Security \u2192 Microphone'
    }
    return {
      type: 'text' as const,
      value: `麦克风访问被拒绝。要启用它，请前往 ${guidance}，然后再次运行 /voice。`,
    }
  }

  // All checks passed — enable voice
  const result = updateSettingsForSource('userSettings', { voiceEnabled: true })
  if (result.error) {
    return {
      type: 'text' as const,
        value:
          '更新设置失败。请检查设置文件是否有语法错误。',
    }
  }
  settingsChangeDetector.notifyChange('userSettings')
  logEvent('tengu_voice_toggled', { enabled: true })
  const key = getShortcutDisplay('voice:pushToTalk', 'Chat', 'Space')
  const stt = normalizeLanguageForSTT(currentSettings.language)
  const cfg = getGlobalConfig()
  // Reset the hint counter whenever the resolved STT language changes
  // (including first-ever enable, where lastLanguage is undefined).
  const langChanged = cfg.voiceLangHintLastLanguage !== stt.code
  const priorCount = langChanged ? 0 : (cfg.voiceLangHintShownCount ?? 0)
  const showHint = !stt.fellBackFrom && priorCount < LANG_HINT_MAX_SHOWS
  let langNote = ''
  if (stt.fellBackFrom) {
    langNote = ` 注意："${stt.fellBackFrom}" 不是支持的听写语言；正在使用英语。可通过 /config 更改。`
  } else if (showHint) {
    langNote = ` 听写语言：${stt.code}（通过 /config 更改）。`
  }
  if (langChanged || showHint) {
    saveGlobalConfig(prev => ({
      ...prev,
      voiceLangHintShownCount: priorCount + (showHint ? 1 : 0),
      voiceLangHintLastLanguage: stt.code,
    }))
  }
  return {
    type: 'text' as const,
    value: `语音模式已启用。按住 ${key} 录音。${langNote}`,
  }
}
