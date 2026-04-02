import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { constants as fsConstants } from 'fs'
import { mkdir, open } from 'fs/promises'
import { dirname, isAbsolute, join, normalize, sep as pathSep } from 'path'
import type { ToolUseContext } from '../Tool.js'
import type { Command } from '../types/command.js'
import { logForDebugging } from '../utils/debug.js'
import { getBundledSkillsRoot } from '../utils/permissions/filesystem.js'
import type { HooksSettings } from '../utils/settings/types.js'

/**
 * 随 CLI 一起发货的捆绑技能定义。
 * 这些在启动时以编程方式注册。
 */
export type BundledSkillDefinition = {
  name: string
  description: string
  aliases?: string[]
  whenToUse?: string
  argumentHint?: string
  allowedTools?: string[]
  model?: string
  disableModelInvocation?: boolean
  userInvocable?: boolean
  isEnabled?: () => boolean
  hooks?: HooksSettings
  context?: 'inline' | 'fork'
  agent?: string
  /**
   * 首次调用时要提取到磁盘的额外引用文件。
   * 键是相对路径（正斜杠，无 `..`），值是内容。
   * 设置后，技能提示会添加"为此技能的基目录：<dir>"前缀，
   * 以便模型可以按需读取/搜索这些文件 —
   * 与基于磁盘的技能相同。
   */
  files?: Record<string, string>
  getPromptForCommand: (
    args: string,
    context: ToolUseContext,
  ) => Promise<ContentBlockParam[]>
}

// 捆绑技能的内部注册表
const bundledSkills: Command[] = []

/**
 * 注册一个可供模型使用的捆绑技能。
 * 在模块初始化或初始化函数中调用此函数。
 *
 * 捆绑技能被编译到 CLI 二进制文件中，所有用户都可以使用。
 * 它们遵循与 registerPostSamplingHook() 相同的内部功能模式。
 */
export function registerBundledSkill(definition: BundledSkillDefinition): void {
  const { files } = definition

  let skillRoot: string | undefined
  let getPromptForCommand = definition.getPromptForCommand

  if (files && Object.keys(files).length > 0) {
    skillRoot = getBundledSkillExtractDir(definition.name)
    // 闭包本地记忆化：每个进程提取一次。
    // 记忆化 promise（而非结果），以便并发调用者等待
    // 相同的提取而不是竞态写入。
    let extractionPromise: Promise<string | null> | undefined
    const inner = definition.getPromptForCommand
    getPromptForCommand = async (args, ctx) => {
      extractionPromise ??= extractBundledSkillFiles(definition.name, files)
      const extractedDir = await extractionPromise
      const blocks = await inner(args, ctx)
      if (extractedDir === null) return blocks
      return prependBaseDir(blocks, extractedDir)
    }
  }

  const command: Command = {
    type: 'prompt',
    name: definition.name,
    description: definition.description,
    aliases: definition.aliases,
    hasUserSpecifiedDescription: true,
    allowedTools: definition.allowedTools ?? [],
    argumentHint: definition.argumentHint,
    whenToUse: definition.whenToUse,
    model: definition.model,
    disableModelInvocation: definition.disableModelInvocation ?? false,
    userInvocable: definition.userInvocable ?? true,
    contentLength: 0, // 捆绑技能不适用
    source: 'bundled',
    loadedFrom: 'bundled',
    hooks: definition.hooks,
    skillRoot,
    context: definition.context,
    agent: definition.agent,
    isEnabled: definition.isEnabled,
    isHidden: !(definition.userInvocable ?? true),
    progressMessage: 'running',
    getPromptForCommand,
  }
  bundledSkills.push(command)
}

/**
 * 获取所有已注册的捆绑技能。
 * 返回副本以防止外部修改。
 */
export function getBundledSkills(): Command[] {
  return [...bundledSkills]
}

/**
 * 清除捆绑技能注册表（用于测试）。
 */
export function clearBundledSkills(): void {
  bundledSkills.length = 0
}

/**
 * 捆绑技能引用文件的确定性提取目录。
 */
export function getBundledSkillExtractDir(skillName: string): string {
  return join(getBundledSkillsRoot(), skillName)
}

/**
 * 将捆绑技能的引用文件提取到磁盘，以便模型可以
 * 按需读取/搜索。首次调用技能时惰性调用。
 *
 * 返回写入的目录，如果写入失败则返回 null（技能
 * 继续工作，只是不带基目录前缀）。
 */
async function extractBundledSkillFiles(
  skillName: string,
  files: Record<string, string>,
): Promise<string | null> {
  const dir = getBundledSkillExtractDir(skillName)
  try {
    await writeSkillFiles(dir, files)
    return dir
  } catch (e) {
    logForDebugging(
      `无法将捆绑技能 '${skillName}' 提取到 ${dir}：${e instanceof Error ? e.message : String(e)}`,
    )
    return null
  }
}

async function writeSkillFiles(
  dir: string,
  files: Record<string, string>,
): Promise<void> {
  // 按父目录分组，以便我们每个子树只 mkdir 一次，然后写入。
  const byParent = new Map<string, [string, string][]>()
  for (const [relPath, content] of Object.entries(files)) {
    const target = resolveSkillFilePath(dir, relPath)
    const parent = dirname(target)
    const entry: [string, string] = [target, content]
    const group = byParent.get(parent)
    if (group) group.push(entry)
    else byParent.set(parent, [entry])
  }
  await Promise.all(
    [...byParent].map(async ([parent, entries]) => {
      await mkdir(parent, { recursive: true, mode: 0o700 })
      await Promise.all(entries.map(([p, c]) => safeWriteFile(p, c)))
    }),
  )
}

// getBundledSkillsRoot() 中的每进程 nonce 是防止预创建
// 符号链接/目录的主要防御。明确的 0o700/0o600 模式即使在 umask=0 时
// 也使 nonce 子树仅限所有者，因此通过可预测父目录上的 inotify
// 了解 nonce 的攻击者仍然无法写入其中。
// O_NOFOLLOW|O_EXCL 是双重保险（O_NOFOLLOW 仅保护最终组件）；
// 我们故意不在 EEXIST 上 unlink+重试 — unlink() 也会跟踪中间符号链接。
const O_NOFOLLOW = fsConstants.O_NOFOLLOW ?? 0
// 在 Windows 上，使用字符串标志 — 通过 libuv 数字 O_EXCL 可能产生 EINVAL。
const SAFE_WRITE_FLAGS =
  process.platform === 'win32'
    ? 'wx'
    : fsConstants.O_WRONLY |
      fsConstants.O_CREAT |
      fsConstants.O_EXCL |
      O_NOFOLLOW

async function safeWriteFile(p: string, content: string): Promise<void> {
  const fh = await open(p, SAFE_WRITE_FLAGS, 0o600)
  try {
    await fh.writeFile(content, 'utf8')
  } finally {
    await fh.close()
  }
}

/** 规范化并验证技能相对路径；遍历时抛出错误。 */
function resolveSkillFilePath(baseDir: string, relPath: string): string {
  const normalized = normalize(relPath)
  if (
    isAbsolute(normalized) ||
    normalized.split(pathSep).includes('..') ||
    normalized.split('/').includes('..')
  ) {
    throw new Error(`打包的 skill 文件路径超出 skill 目录：${relPath}`)
  }
  return join(baseDir, normalized)
}

function prependBaseDir(
  blocks: ContentBlockParam[],
  baseDir: string,
): ContentBlockParam[] {
  const prefix = `为此技能的基目录：${baseDir}\n\n`
  if (blocks.length > 0 && blocks[0]!.type === 'text') {
    return [
      { type: 'text', text: prefix + blocks[0]!.text },
      ...blocks.slice(1),
    ]
  }
  return [{ type: 'text', text: prefix }, ...blocks]
}