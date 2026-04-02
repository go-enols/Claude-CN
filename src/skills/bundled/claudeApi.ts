import { readdir } from 'fs/promises'
import { getCwd } from '../../utils/cwd.js'
import { registerBundledSkill } from '../bundledSkills.js'

// claudeApiContent.js 捆绑了 247KB 的 .md 字符串。在
// getPromptForCommand 内部惰性加载，以便仅当调用 /claude-api 时它们才会进入内存。
type SkillContent = typeof import('./claudeApiContent.js')

type DetectedLanguage =
  | 'python'
  | 'typescript'
  | 'java'
  | 'go'
  | 'ruby'
  | 'csharp'
  | 'php'
  | 'curl'

const LANGUAGE_INDICATORS: Record<DetectedLanguage, string[]> = {
  python: ['.py', 'requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile'],
  typescript: ['.ts', '.tsx', 'tsconfig.json', 'package.json'],
  java: ['.java', 'pom.xml', 'build.gradle'],
  go: ['.go', 'go.mod'],
  ruby: ['.rb', 'Gemfile'],
  csharp: ['.cs', '.csproj'],
  php: ['.php', 'composer.json'],
  curl: [],
}

async function detectLanguage(): Promise<DetectedLanguage | null> {
  const cwd = getCwd()
  let entries: string[]
  try {
    entries = await readdir(cwd)
  } catch {
    return null
  }

  for (const [lang, indicators] of Object.entries(LANGUAGE_INDICATORS) as [
    DetectedLanguage,
    string[],
  ][]) {
    if (indicators.length === 0) continue
    for (const indicator of indicators) {
      if (indicator.startsWith('.')) {
        if (entries.some(e => e.endsWith(indicator))) return lang
      } else {
        if (entries.includes(indicator)) return lang
      }
    }
  }
  return null
}

function getFilesForLanguage(
  lang: DetectedLanguage,
  content: SkillContent,
): string[] {
  return Object.keys(content.SKILL_FILES).filter(
    path => path.startsWith(`${lang}/`) || path.startsWith('shared/'),
  )
}

function processContent(md: string, content: SkillContent): string {
  // 剥离 HTML 注释。循环处理嵌套注释。
  let out = md
  let prev
  do {
    prev = out
    out = out.replace(/<!--[\s\S]*?-->\n?/g, '')
  } while (out !== prev)

  out = out.replace(
    /\{\{(\w+)\}\}/g,
    (match, key: string) =>
      (content.SKILL_MODEL_VARS as Record<string, string>)[key] ?? match,
  )
  return out
}

function buildInlineReference(
  filePaths: string[],
  content: SkillContent,
): string {
  const sections: string[] = []
  for (const filePath of filePaths.sort()) {
    const md = content.SKILL_FILES[filePath]
    if (!md) continue
    sections.push(
      `<doc path="${filePath}">\n${processContent(md, content).trim()}\n</doc>`,
    )
  }
  return sections.join('\n\n')
}

const INLINE_READING_GUIDE = `## 参考文档

您检测到的语言的相关文档包含在下面的 \`<doc>\` 标签中。每个标签都有一个 \`path\` 属性，显示其原始文件路径。使用它来找到正确的部分：

### 快速任务参考

**单个文本分类/摘要/提取/问答：**
→ 参见 \`{lang}/claude-api/README.md\`

**聊天 UI 或实时响应显示：**
→ 参见 \`{lang}/claude-api/README.md\` + \`{lang}/claude-api/streaming.md\`

**长时间运行的对话（可能超出上下文窗口）：**
→ 参见 \`{lang}/claude-api/README.md\` — 参见 Compaction 部分

**提示缓存 / 优化缓存 / "为什么我的缓存命中率低"：**
→ 参见 \`shared/prompt-caching.md\` + \`{lang}/claude-api/README.md\`（提示缓存部分）

**函数调用 / 工具使用 / 代理：**
→ 参见 \`{lang}/claude-api/README.md\` + \`shared/tool-use-concepts.md\` + \`{lang}/claude-api/tool-use.md\`

**批量处理（非延迟敏感）：**
→ 参见 \`{lang}/claude-api/README.md\` + \`{lang}/claude-api/batches.md\`

**跨多个请求的文件上传：**
→ 参见 \`{lang}/claude-api/README.md\` + \`{lang}/claude-api/files-api.md\`

**具有内置工具的代理（文件/网络/终端）（仅限 Python 和 TypeScript）：**
→ 参见 \`{lang}/agent-sdk/README.md\` + \`{lang}/agent-sdk/patterns.md\`

**错误处理：**
→ 参见 \`shared/error-codes.md\`

**通过 WebFetch 获取最新文档：**
→ 参见 \`shared/live-sources.md\` 获取 URL`

function buildPrompt(
  lang: DetectedLanguage | null,
  args: string,
  content: SkillContent,
): string {
  // 获取 SKILL.md 内容到"阅读指南"部分
  const cleanPrompt = processContent(content.SKILL_PROMPT, content)
  const readingGuideIdx = cleanPrompt.indexOf('## Reading Guide')
  const basePrompt =
    readingGuideIdx !== -1
      ? cleanPrompt.slice(0, readingGuideIdx).trimEnd()
      : cleanPrompt

  const parts: string[] = [basePrompt]

  if (lang) {
    const filePaths = getFilesForLanguage(lang, content)
    const readingGuide = INLINE_READING_GUIDE.replace(/\{lang\}/g, lang)
    parts.push(readingGuide)
    parts.push(
      '---\n\n## 包含的文档\n\n' +
        buildInlineReference(filePaths, content),
    )
  } else {
    // 未检测到语言 — 包含所有文档，让模型询问
    parts.push(INLINE_READING_GUIDE.replace(/\{lang\}/g, 'unknown'))
    parts.push(
      '未自动检测到项目语言。询问用户正在使用哪种语言，然后参考下面的匹配文档。',
    )
    parts.push(
      '---\n\n## 包含的文档\n\n' +
        buildInlineReference(Object.keys(content.SKILL_FILES), content),
    )
  }

  // 保留"何时使用 WebFetch"和"常见陷阱"部分
  const webFetchIdx = cleanPrompt.indexOf('## When to Use WebFetch')
  if (webFetchIdx !== -1) {
    parts.push(cleanPrompt.slice(webFetchIdx).trimEnd())
  }

  if (args) {
    parts.push(`## 用户请求\n\n${args}`)
  }

  return parts.join('\n\n')
}

export function registerClaudeApiSkill(): void {
  registerBundledSkill({
    name: 'claude-api',
    description:
      '使用 Claude API 或 Anthropic SDK 构建应用。\n' +
      '触发条件：代码导入 `anthropic`/`@anthropic-ai/sdk`/`claude_agent_sdk`，或用户要求使用 Claude API、Anthropic SDK 或 Agent SDK。\n' +
      '不触发条件：代码导入 `openai`/其他 AI SDK，一般编程，或 ML/数据科学任务。',
    allowedTools: ['Read', 'Grep', 'Glob', 'WebFetch'],
    userInvocable: true,
    async getPromptForCommand(args) {
      const content = await import('./claudeApiContent.js')
      const lang = await detectLanguage()
      const prompt = buildPrompt(lang, args, content)
      return [{ type: 'text', text: prompt }]
    },
  })
}