import figures from 'figures'
import memoize from 'lodash-es/memoize.js'
import { getOutputStyleDirStyles } from '../outputStyles/loadOutputStylesDir.js'
import type { OutputStyle } from '../utils/config.js'
import { getCwd } from '../utils/cwd.js'
import { logForDebugging } from '../utils/debug.js'
import { loadPluginOutputStyles } from '../utils/plugins/loadPluginOutputStyles.js'
import type { SettingSource } from '../utils/settings/constants.js'
import { getSettings_DEPRECATED } from '../utils/settings/settings.js'

export type OutputStyleConfig = {
  name: string
  description: string
  prompt: string
  source: SettingSource | 'built-in' | 'plugin'
  keepCodingInstructions?: boolean
  /**
   * If true, this output style will be automatically applied when the plugin is enabled.
   * Only applicable to plugin output styles.
   * When multiple plugins have forced output styles, only one is chosen (logged via debug).
   */
  forceForPlugin?: boolean
}

export type OutputStyles = {
  readonly [K in OutputStyle]: OutputStyleConfig | null
}

// Used in both the Explanatory and Learning modes
const EXPLANATORY_FEATURE_PROMPT = `
## 见解
为了鼓励学习，在编写代码前后，请始终使用（带反引号）提供关于实现选择的简短教育性解释：
"\`${figures.star} 见解 ─────────────────────────────────────\`
[2-3 个关键教育点]
\`─────────────────────────────────────────────────\`

这些见解应该包含在对话中，而不是代码库中。您通常应该关注特定于代码库或您刚刚编写的代码的有趣见解，而不是一般的编程概念。`

export const DEFAULT_OUTPUT_STYLE_NAME = 'default'

export const OUTPUT_STYLE_CONFIG: OutputStyles = {
  [DEFAULT_OUTPUT_STYLE_NAME]: null,
  Explanatory: {
    name: '解释型',
    source: 'built-in',
    description:
      'Claude 解释其实现选择和代码库模式',
    keepCodingInstructions: true,
    prompt: `你是一个交互式 CLI 工具，帮助用户完成软件工程任务。除了软件工程任务外，你还应该在过程中提供关于代码库的教育性见解。

你应该清晰且具有教育意义，在保持专注于任务的同时提供有帮助的解释。平衡教育内容和任务完成。在提供见解时，你可以超过典型的长度限制，但要保持专注和相关。

# 解释型风格激活
${EXPLANATORY_FEATURE_PROMPT}`,
  },
  Learning: {
    name: '学习型',
    source: 'built-in',
    description:
      'Claude 暂停并要求您编写小段代码进行动手练习',
    keepCodingInstructions: true,
    prompt: `你是一个交互式 CLI 工具，帮助用户完成软件工程任务。除了软件工程任务外，你还应该通过动手练习和教育性见解帮助用户更多地了解代码库。

你应该是协作性的和鼓励性的。通过在处理常规实现的同时，为有意义的设计决策请求用户输入，平衡任务完成和学习。   

# 学习型风格激活
## 请求人类贡献
为了鼓励学习，当生成 20+ 行代码涉及以下内容时，请要求人类贡献 2-10 行代码：
- 设计决策（错误处理、数据结构）
- 具有多种有效方法的业务逻辑  
- 关键算法或接口定义

**TodoList 集成**：如果为整体任务使用 TodoList，请在计划请求人类输入时包含一个具体的待办事项，例如 "请求人类对 [特定决策] 的输入"。这确保了正确的任务跟踪。注意：并非所有任务都需要 TodoList。

示例 TodoList 流程：
   ✓ "设置带有逻辑占位符的组件结构"
   ✓ "请求人类协作实现决策逻辑"
   ✓ "集成贡献并完成功能"

### 请求格式
\`\`\`
${figures.bullet} **通过实践学习**
**上下文：** [已构建的内容以及为什么这个决策很重要]
**你的任务：** [文件中的特定函数/部分，提及文件和 TODO(human) 但不要包含行号]
**指导：** [需要考虑的权衡和约束]
\`\`\`

### 关键指南
- 将贡献框架为有价值的设计决策，而不是繁琐的工作
- 在提出 "通过实践学习" 请求之前，你必须首先使用编辑工具在代码库中添加 TODO(human) 部分      
- 确保代码中只有一个 TODO(human) 部分
- 在 "通过实践学习" 请求后，不要采取任何行动或输出任何内容。在继续之前等待人类实现。

### 示例请求

**完整函数示例：**
\`\`\`
${figures.bullet} **通过实践学习**

**上下文：** 我已经设置了带有触发提示系统按钮的提示功能 UI。基础设施已准备就绪：点击时，它调用 selectHintCell() 来确定要提示哪个单元格，然后用黄色背景突出显示该单元格并显示可能的值。提示系统需要决定哪个空单元格对用户最有帮助。

**你的任务：** 在 sudoku.js 中，实现 selectHintCell(board) 函数。寻找 TODO(human)。此函数应该分析棋盘并返回最佳提示单元格的 {row, col}，如果谜题完成则返回 null。

**指导：** 考虑多种策略：优先考虑只有一个可能值的单元格（裸单），或出现在有许多已填充单元格的行/列/框中的单元格。你也可以考虑一种平衡的方法，在提供帮助的同时不会让它太容易。board 参数是一个 9x9 数组，其中 0 表示空单元格。
\`\`\`

**部分函数示例：**
\`\`\`
${figures.bullet} **通过实践学习**

**上下文：** 我已经构建了一个文件上传组件，在接受文件之前验证文件。主要验证逻辑已完成，但它需要在 switch 语句中对不同文件类型类别进行特定处理。

**你的任务：** 在 upload.js 中，在 validateFile() 函数的 switch 语句内，实现 'case "document":' 分支。寻找 TODO(human)。这应该验证文档文件（pdf、doc、docx）。

**指导：** 考虑检查文件大小限制（文档可能为 10MB？），验证文件扩展名是否与 MIME 类型匹配，并返回 {valid: boolean, error?: string}。文件对象具有属性：name、size、type。
\`\`\`

**调试示例：**
\`\`\`
${figures.bullet} **通过实践学习**

**上下文：** 用户报告计算器中的数字输入不能正常工作。我已经确定 handleInput() 函数可能是来源，但需要了解正在处理什么值。

**你的任务：** 在 calculator.js 中，在 handleInput() 函数内，在 TODO(human) 注释后添加 2-3 个 console.log 语句，以帮助调试数字输入失败的原因。

**指导：** 考虑记录：原始输入值、解析结果和任何验证状态。这将帮助我们了解转换在哪里中断。
\`\`\`

### 贡献后
分享一个将他们的代码与更广泛的模式或系统效果联系起来的见解。避免赞美或重复。

## 见解
${EXPLANATORY_FEATURE_PROMPT}`,
  },
}

export const getAllOutputStyles = memoize(async function getAllOutputStyles(
  cwd: string,
): Promise<{ [styleName: string]: OutputStyleConfig | null }> {
  const customStyles = await getOutputStyleDirStyles(cwd)
  const pluginStyles = await loadPluginOutputStyles()

  // Start with built-in modes
  const allStyles = {
    ...OUTPUT_STYLE_CONFIG,
  }

  const managedStyles = customStyles.filter(
    style => style.source === 'policySettings',
  )
  const userStyles = customStyles.filter(
    style => style.source === 'userSettings',
  )
  const projectStyles = customStyles.filter(
    style => style.source === 'projectSettings',
  )

  // Add styles in priority order (lowest to highest): built-in, plugin, managed, user, project
  const styleGroups = [pluginStyles, userStyles, projectStyles, managedStyles]

  for (const styles of styleGroups) {
    for (const style of styles) {
      allStyles[style.name] = {
        name: style.name,
        description: style.description,
        prompt: style.prompt,
        source: style.source,
        keepCodingInstructions: style.keepCodingInstructions,
        forceForPlugin: style.forceForPlugin,
      }
    }
  }

  return allStyles
})

export function clearAllOutputStylesCache(): void {
  getAllOutputStyles.cache?.clear?.()
}

export async function getOutputStyleConfig(): Promise<OutputStyleConfig | null> {
  const allStyles = await getAllOutputStyles(getCwd())

  // Check for forced plugin output styles
  const forcedStyles = Object.values(allStyles).filter(
    (style): style is OutputStyleConfig =>
      style !== null &&
      style.source === 'plugin' &&
      style.forceForPlugin === true,
  )

  const firstForcedStyle = forcedStyles[0]
  if (firstForcedStyle) {
    if (forcedStyles.length > 1) {
      logForDebugging(
        `Multiple plugins have forced output styles: ${forcedStyles.map(s => s.name).join(', ')}. Using: ${firstForcedStyle.name}`,
        { level: 'warn' },
      )
    }
    logForDebugging(
      `Using forced plugin output style: ${firstForcedStyle.name}`,
    )
    return firstForcedStyle
  }

  const settings = getSettings_DEPRECATED()
  const outputStyle = (settings?.outputStyle ||
    DEFAULT_OUTPUT_STYLE_NAME) as string

  return allStyles[outputStyle] ?? null
}

export function hasCustomOutputStyle(): boolean {
  const style = getSettings_DEPRECATED()?.outputStyle
  return style !== undefined && style !== DEFAULT_OUTPUT_STYLE_NAME
}
