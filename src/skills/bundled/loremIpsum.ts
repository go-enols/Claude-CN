import { registerBundledSkill } from '../bundledSkills.js'

// 验证过的 1-token 单词（通过 API token 计数测试）
// 所有常见英语单词确认为单个 token
const ONE_TOKEN_WORDS = [
  // 冠词和代词
  'the',
  'a',
  'an',
  'I',
  'you',
  'he',
  'she',
  'it',
  'we',
  'they',
  'me',
  'him',
  'her',
  'us',
  'them',
  'my',
  'your',
  'his',
  'its',
  'our',
  'this',
  'that',
  'what',
  'who',
  // 常见动词
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'can',
  'could',
  'may',
  'might',
  'must',
  'shall',
  'should',
  'make',
  'made',
  'get',
  'got',
  'go',
  'went',
  'come',
  'came',
  'see',
  'saw',
  'know',
  'take',
  'think',
  'look',
  'want',
  'use',
  'find',
  'give',
  'tell',
  'work',
  'call',
  'try',
  'ask',
  'need',
  'feel',
  'seem',
  'leave',
  'put',
  // 常见名词和形容词
  'time',
  'year',
  'day',
  'way',
  'man',
  'thing',
  'life',
  'hand',
  'part',
  'place',
  'case',
  'point',
  'fact',
  'good',
  'new',
  'first',
  'last',
  'long',
  'great',
  'little',
  'own',
  'other',
  'old',
  'right',
  'big',
  'high',
  'small',
  'large',
  'next',
  'early',
  'young',
  'few',
  'public',
  'bad',
  'same',
  'able',
  // 介词和连词
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'from',
  'by',
  'about',
  'like',
  'through',
  'over',
  'before',
  'between',
  'under',
  'since',
  'without',
  'and',
  'or',
  'but',
  'if',
  'than',
  'because',
  'as',
  'until',
  'while',
  'so',
  'though',
  'both',
  'each',
  'when',
  'where',
  'why',
  'how',
  // 常见副词
  'not',
  'now',
  'just',
  'more',
  'also',
  'here',
  'there',
  'then',
  'only',
  'very',
  'well',
  'back',
  'still',
  'even',
  'much',
  'too',
  'such',
  'never',
  'again',
  'most',
  'once',
  'off',
  'away',
  'down',
  'out',
  'up',
  // 技术/常见词
  'test',
  'code',
  'data',
  'file',
  'line',
  'text',
  'word',
  'number',
  'system',
  'program',
  'set',
  'run',
  'value',
  'name',
  'type',
  'state',
  'end',
  'start',
]

function generateLoremIpsum(targetTokens: number): string {
  let tokens = 0
  let result = ''

  while (tokens < targetTokens) {
    // 句子：10-20 个单词
    const sentenceLength = 10 + Math.floor(Math.random() * 11)
    let wordsInSentence = 0

    for (let i = 0; i < sentenceLength && tokens < targetTokens; i++) {
      const word =
        ONE_TOKEN_WORDS[Math.floor(Math.random() * ONE_TOKEN_WORDS.length)]
      result += word
      tokens++
      wordsInSentence++

      if (i === sentenceLength - 1 || tokens >= targetTokens) {
        result += '. '
      } else {
        result += ' '
      }
    }

    // 每 5-8 句分段（每句约 20% 概率）
    if (wordsInSentence > 0 && Math.random() < 0.2 && tokens < targetTokens) {
      result += '\n\n'
    }
  }

  return result.trim()
}

export function registerLoremIpsumSkill(): void {
  if (process.env.USER_TYPE !== 'ant') {
    return
  }

  registerBundledSkill({
    name: 'lorem-ipsum',
    description:
      '为长上下文测试生成填充文本。将 token 数量指定为参数（例如 /lorem-ipsum 50000）。输出大约请求的 token 数量。仅限 Ant。',
    argumentHint: '[token_count]',
    userInvocable: true,
    async getPromptForCommand(args) {
      const parsed = parseInt(args)

      if (args && (isNaN(parsed) || parsed <= 0)) {
        return [
          {
            type: 'text',
            text: '无效的 token 数量。请提供一个正数（例如 /lorem-ipsum 10000）。',
          },
        ]
      }

      const targetTokens = parsed || 10000

      // 为安全起见，上限为 500k tokens
      const cappedTokens = Math.min(targetTokens, 500_000)

      if (cappedTokens < targetTokens) {
        return [
          {
            type: 'text',
            text: `请求了 ${targetTokens} tokens，但为安全起见上限为 500,000。\n\n${generateLoremIpsum(cappedTokens)}`,
          },
        ]
      }

      const loremText = generateLoremIpsum(cappedTokens)

      // 将 lorem ipsum 文本直接转储到对话中
      return [
        {
          type: 'text',
          text: loremText,
        },
      ]
    },
  })
}