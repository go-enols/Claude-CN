import { feature } from 'bun:bundle'
import type { Message } from '../types/message.js'
import type { Attachment } from '../utils/attachments.js'
import { getGlobalConfig } from '../utils/config.js'
import { getCompanion } from './companion.js'

export function companionIntroText(name: string, species: string): string {
  return `# 伙伴

一只名为 ${name} 的小${species}坐在用户的输入框旁边，偶尔会在对话气泡中发表评论。你不是 ${name} —— 它是一个独立的观察者。

当用户直接称呼 ${name}（通过名字）时，它的气泡会回答。你在那一刻的工作是不要挡道：用一行或更少的内容回复，或者直接回答消息中任何属于你的部分。不要解释你不是 ${name} —— 他们知道。不要叙述 ${name} 可能会说什么 —— 气泡会处理这些。`
}

export function getCompanionIntroAttachment(
  messages: Message[] | undefined,
): Attachment[] {
  if (!feature('BUDDY')) return []
  const companion = getCompanion()
  if (!companion || getGlobalConfig().companionMuted) return []

  // Skip if already announced for this companion.
  for (const msg of messages ?? []) {
    if (msg.type !== 'attachment') continue
    if (msg.attachment.type !== 'companion_intro') continue
    if (msg.attachment.name === companion.name) return []
  }

  return [
    {
      type: 'companion_intro',
      name: companion.name,
      species: companion.species,
    },
  ]
}
