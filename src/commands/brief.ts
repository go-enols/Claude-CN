import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import { getKairosActive, setUserMsgOptIn } from '../bootstrap/state.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../services/analytics/growthbook.js'
import {
  type AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  logEvent,
} from '../services/analytics/index.js'
import type { ToolUseContext } from '../Tool.js'
import { isBriefEntitled } from '../tools/BriefTool/BriefTool.js'
import { BRIEF_TOOL_NAME } from '../tools/BriefTool/prompt.js'
import type {
  Command,
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../types/command.js'
import { lazySchema } from '../utils/lazySchema.js'

// Zod guards against fat-fingered GB pushes (same pattern as pollConfig.ts /
// cronScheduler.ts). A malformed config falls back to DEFAULT_BRIEF_CONFIG
// entirely rather than being partially trusted.
const briefConfigSchema = lazySchema(() =>
  z.object({
    enable_slash_command: z.boolean(),
  }),
)
type BriefConfig = z.infer<ReturnType<typeof briefConfigSchema>>

const DEFAULT_BRIEF_CONFIG: BriefConfig = {
  enable_slash_command: false,
}

// No TTL — this gate controls slash-command *visibility*, not a kill switch.
// CACHED_MAY_BE_STALE still has one background-update flip (first call kicks
// off fetch; second call sees fresh value), but no additional flips after that.
// The tool-availability gate (tengu_kairos_brief in isBriefEnabled) keeps its
// 5-min TTL because that one IS a kill switch.
function getBriefConfig(): BriefConfig {
  const raw = getFeatureValue_CACHED_MAY_BE_STALE<unknown>(
    'tengu_kairos_brief_config',
    DEFAULT_BRIEF_CONFIG,
  )
  const parsed = briefConfigSchema().safeParse(raw)
  return parsed.success ? parsed.data : DEFAULT_BRIEF_CONFIG
}

const brief = {
  type: 'local-jsx',
  name: 'brief',
  description: '切换简洁模式',
  isEnabled: () => {
    if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
      return getBriefConfig().enable_slash_command
    }
    return false
  },
  immediate: true,
  load: () =>
    Promise.resolve({
      async call(
        onDone: LocalJSXCommandOnDone,
        context: ToolUseContext & LocalJSXCommandContext,
      ): Promise<React.ReactNode> {
        const current = context.getAppState().isBriefOnly
        const newState = !current

        // Entitlement check only gates the on-transition — off is always
        // allowed so a user whose GB gate flipped mid-session isn't stuck.
        if (newState && !isBriefEntitled()) {
          logEvent('tengu_brief_mode_toggled', {
            enabled: false,
            gated: true,
            source:
              'slash_command' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
          })
          onDone('Brief 工具未在您的账户上启用', {
            display: 'system',
          })
          return null
        }

        // Two-way: userMsgOptIn tracks isBriefOnly so the tool is available
        // exactly when brief mode is on. This invalidates prompt cache on
        // each toggle (tool list changes), but a stale tool list is worse —
        // when /brief is enabled mid-session the model was previously left
        // without the tool, emitting plain text the filter hides.
        setUserMsgOptIn(newState)

        context.setAppState(prev => {
          if (prev.isBriefOnly === newState) return prev
          return { ...prev, isBriefOnly: newState }
        })

        logEvent('tengu_brief_mode_toggled', {
          enabled: newState,
          gated: false,
          source:
            'slash_command' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        })

        // The tool list change alone isn't a strong enough signal mid-session
        // (model may keep emitting plain text from inertia, or keep calling a
        // tool that just vanished). Inject an explicit reminder into the next
        // turn's context so the transition is unambiguous.
        // Skip when Kairos is active: isBriefEnabled() short-circuits on
        // getKairosActive() so the tool never actually leaves the list, and
        // the Kairos system prompt already mandates SendUserMessage.
        // Inline <system-reminder> wrap — importing wrapInSystemReminder from
        // utils/messages.ts pulls constants/xml.ts into the bridge SDK bundle
        // via this module's import chain, tripping the excluded-strings check.
        const metaMessages = getKairosActive()
          ? undefined
          : [
              `<system-reminder>\n${
                newState
                  ? `简洁模式现已启用。请使用 ${BRIEF_TOOL_NAME} 工具进行所有用户面向的输出——纯文本将隐藏于用户视野之外。`
                  : `简洁模式现已禁用。${BRIEF_TOOL_NAME} 工具不再可用——请用纯文本回复。`
              }\n</system-reminder>`,
            ]

        onDone(
          newState ? '简洁模式已启用' : '简洁模式已禁用',
          { display: 'system', metaMessages },
        )
        return null
      },
    }),
} satisfies Command

export default brief
