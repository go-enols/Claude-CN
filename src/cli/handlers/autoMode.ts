/**
 * Auto mode subcommand handlers — dump default/merged classifier rules and
 * critique user-written rules. Dynamically imported when `claude auto-mode ...` runs.
 */

import { errorMessage } from '../../utils/errors.js'
import {
  getMainLoopModel,
  parseUserSpecifiedModel,
} from '../../utils/model/model.js'
import {
  type AutoModeRules,
  buildDefaultExternalSystemPrompt,
  getDefaultExternalAutoModeRules,
} from '../../utils/permissions/yoloClassifier.js'
import { getAutoModeConfig } from '../../utils/settings/settings.js'
import { sideQuery } from '../../utils/sideQuery.js'
import { jsonStringify } from '../../utils/slowOperations.js'

function writeRules(rules: AutoModeRules): void {
  process.stdout.write(jsonStringify(rules, null, 2) + '\n')
}

export function autoModeDefaultsHandler(): void {
  writeRules(getDefaultExternalAutoModeRules())
}

/**
 * Dump the effective auto mode config: user settings where provided, external
 * defaults otherwise. Per-section REPLACE semantics — matches how
 * buildYoloSystemPrompt resolves the external template (a non-empty user
 * section replaces that section's defaults entirely; an empty/absent section
 * falls through to defaults).
 */
export function autoModeConfigHandler(): void {
  const config = getAutoModeConfig()
  const defaults = getDefaultExternalAutoModeRules()
  writeRules({
    allow: config?.allow?.length ? config.allow : defaults.allow,
    soft_deny: config?.soft_deny?.length
      ? config.soft_deny
      : defaults.soft_deny,
    environment: config?.environment?.length
      ? config.environment
      : defaults.environment,
  })
}

const CRITIQUE_SYSTEM_PROMPT =
  'You are an expert reviewer of auto mode classifier rules for Claude Code.\n' +
  '\n' +
  'Claude Code has an "auto mode" that uses an AI classifier to decide whether ' +
  'tool calls should be auto-approved or require user confirmation. Users can ' +
  'write custom rules in three categories:\n' +
  '\n' +
  '- **allow**: Actions the classifier should auto-approve\n' +
  '- **soft_deny**: Actions the classifier should block (require user confirmation)\n' +
  "- **environment**: Context about the user's setup that helps the classifier make decisions\n" +
  '\n' +
  "Your job is to critique the user's custom rules for clarity, completeness, " +
  'and potential issues. The classifier is an LLM that reads these rules as ' +
  'part of its system prompt.\n' +
  '\n' +
  'For each rule, evaluate:\n' +
  '1. **Clarity**: Is the rule unambiguous? Could the classifier misinterpret it?\n' +
  "2. **Completeness**: Are there gaps or edge cases the rule doesn't cover?\n" +
  '3. **Conflicts**: Do any of the rules conflict with each other?\n' +
  '4. **Actionability**: Is the rule specific enough for the classifier to act on?\n' +
  '\n' +
  'Be concise and constructive. Only comment on rules that could be improved. ' +
  'If all rules look good, say so.'

export async function autoModeCritiqueHandler(options: {
  model?: string
}): Promise<void> {
  const config = getAutoModeConfig()
  const hasCustomRules =
    (config?.allow?.length ?? 0) > 0 ||
    (config?.soft_deny?.length ?? 0) > 0 ||
    (config?.environment?.length ?? 0) > 0

  if (!hasCustomRules) {
    process.stdout.write(
      '未找到自定义自动模式规则。\n\n' +
        '在设置文件中的 autoMode.{allow, soft_deny, environment} 下添加规则。\n' +
        '运行 `claude auto-mode defaults` 查看默认规则以供参考。\n',
    )
    return
  }

  const model = options.model
    ? parseUserSpecifiedModel(options.model)
    : getMainLoopModel()

  const defaults = getDefaultExternalAutoModeRules()
  const classifierPrompt = buildDefaultExternalSystemPrompt()

  const userRulesSummary =
    formatRulesForCritique('allow', config?.allow ?? [], defaults.allow) +
    formatRulesForCritique(
      'soft_deny',
      config?.soft_deny ?? [],
      defaults.soft_deny,
    ) +
    formatRulesForCritique(
      'environment',
      config?.environment ?? [],
      defaults.environment,
    )

  process.stdout.write('正在分析您的自动模式规则…\n\n')

  let response
  try {
    response = await sideQuery({
      querySource: 'auto_mode_critique',
      model,
      system: CRITIQUE_SYSTEM_PROMPT,
      skipSystemPromptPrefix: true,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content:
            '以下是自动模式分类器接收的完整分类器系统提示：\n\n' +
            '<classifier_system_prompt>\n' +
            classifierPrompt +
            '\n</classifier_system_prompt>\n\n' +
            '以下是用户的自定义规则，它们会替换相应的默认部分：\n\n' +
            userRulesSummary +
            '\n请对这些自定义规则进行评审。',
        },
      ],
    })
  } catch (error) {
    process.stderr.write(
      '分析规则失败：' + errorMessage(error) + '\n',
    )
    process.exitCode = 1
    return
  }

  const textBlock = response.content.find(block => block.type === 'text')
  if (textBlock?.type === 'text') {
    process.stdout.write(textBlock.text + '\n')
  } else {
    process.stdout.write('未生成评审内容。请重试。\n')
  }
}

function formatRulesForCritique(
  section: string,
  userRules: string[],
  defaultRules: string[],
): string {
  if (userRules.length === 0) return ''
  const customLines = userRules.map(r => '- ' + r).join('\n')
  const defaultLines = defaultRules.map(r => '- ' + r).join('\n')
  return (
    '## ' +
    section +
    ' (custom rules replacing defaults)\n' +
    'Custom:\n' +
    customLines +
    '\n\n' +
    'Defaults being replaced:\n' +
    defaultLines +
    '\n\n'
  )
}
