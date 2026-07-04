import chalk from 'chalk'
import { logEvent } from 'src/services/analytics/index.js'
import {
  getLatestVersion,
  type InstallStatus,
  installGlobalPackage,
} from 'src/utils/autoUpdater.js'
import { regenerateCompletionCache } from 'src/utils/completionCache.js'
import {
  getGlobalConfig,
  type InstallMethod,
  saveGlobalConfig,
} from 'src/utils/config.js'
import { logForDebugging } from 'src/utils/debug.js'
import { getDoctorDiagnostic } from 'src/utils/doctorDiagnostic.js'
import { gracefulShutdown } from 'src/utils/gracefulShutdown.js'
import {
  installOrUpdateClaudePackage,
  localInstallationExists,
} from 'src/utils/localInstaller.js'
import {
  installLatest as installLatestNative,
  removeInstalledSymlink,
} from 'src/utils/nativeInstaller/index.js'
import { getPackageManager } from 'src/utils/nativeInstaller/packageManagers.js'
import { writeToStdout } from 'src/utils/process.js'
import { gte } from 'src/utils/semver.js'
import { getInitialSettings } from 'src/utils/settings/settings.js'

export async function update() {
  logEvent('tengu_update_check', {})
  writeToStdout(`当前版本: ${MACRO.VERSION}\n`)

  const channel = getInitialSettings()?.autoUpdatesChannel ?? 'latest'
  writeToStdout(`正在检查 ${channel} 版本更新...\n`)

  logForDebugging('update: Starting update check')

  // Run diagnostic to detect potential issues
  logForDebugging('update: Running diagnostic')
  const diagnostic = await getDoctorDiagnostic()
  logForDebugging(`update: Installation type: ${diagnostic.installationType}`)
  logForDebugging(
    `update: Config install method: ${diagnostic.configInstallMethod}`,
  )

  // 检查多个安装
  if (diagnostic.multipleInstallations.length > 1) {
    writeToStdout('\n')
    writeToStdout(chalk.yellow('警告: 发现多个安装') + '\n')
    for (const install of diagnostic.multipleInstallations) {
      const current =
        diagnostic.installationType === install.type
          ? ' (当前运行中)'
          : ''
      writeToStdout(`- ${install.type} 在 ${install.path}${current}\n`)
    }
  }

  // 显示警告（如果有）
  if (diagnostic.warnings.length > 0) {
    writeToStdout('\n')
    for (const warning of diagnostic.warnings) {
      logForDebugging(`update: Warning detected: ${warning.issue}`)

      // Don't skip PATH warnings - they're always relevant
      // The user needs to know that 'which claude' points elsewhere
      logForDebugging(`update: Showing warning: ${warning.issue}`)

      writeToStdout(chalk.yellow(`警告: ${warning.issue}\n`))

      writeToStdout(chalk.bold(`修复: ${warning.fix}\n`))
    }
  }

  // 如果 installMethod 未设置，则更新配置（跳过包管理器）
  const config = getGlobalConfig()
  if (
    !config.installMethod &&
    diagnostic.installationType !== 'package-manager'
  ) {
    writeToStdout('\n')
    writeToStdout('更新配置以跟踪安装方式...\n')
    let detectedMethod: 'local' | 'native' | 'global' | 'unknown' = 'unknown'

    // 将诊断安装类型映射到配置安装方式
    switch (diagnostic.installationType) {
      case 'npm-local':
        detectedMethod = 'local'
        break
      case 'native':
        detectedMethod = 'native'
        break
      case 'npm-global':
        detectedMethod = 'global'
        break
      default:
        detectedMethod = 'unknown'
    }

    saveGlobalConfig(current => ({
      ...current,
      installMethod: detectedMethod,
    }))
    writeToStdout(`安装方式已设置为: ${detectedMethod}\n`)
  }

  // 检查是否从开发构建运行
  if (diagnostic.installationType === 'development') {
    writeToStdout('\n')
    writeToStdout(
      chalk.yellow('警告: 无法更新开发构建') + '\n',
    )
    await gracefulShutdown(1)
  }

  // 检查是否从包管理器运行
  if (diagnostic.installationType === 'package-manager') {
    const packageManager = await getPackageManager()
    writeToStdout('\n')

    if (packageManager === 'homebrew') {
      writeToStdout('Claude 由 Homebrew 管理。\n')
      const latest = await getLatestVersion(channel)
      if (latest && !gte(MACRO.VERSION, latest)) {
        writeToStdout(`有更新可用: ${MACRO.VERSION} → ${latest}\n`)
        writeToStdout('\n')
        writeToStdout('要更新，请运行:\n')
        writeToStdout(chalk.bold('  brew upgrade claude-code') + '\n')
      } else {
        writeToStdout('Claude 已是最新版本!\n')
      }
    } else if (packageManager === 'winget') {
      writeToStdout('Claude 由 winget 管理。\n')
      const latest = await getLatestVersion(channel)
      if (latest && !gte(MACRO.VERSION, latest)) {
        writeToStdout(`有更新可用: ${MACRO.VERSION} → ${latest}\n`)
        writeToStdout('\n')
        writeToStdout('要更新，请运行:\n')
        writeToStdout(
          chalk.bold('  winget upgrade Anthropic.ClaudeCode') + '\n',
        )
      } else {
        writeToStdout('Claude 已是最新版本!\n')
      }
    } else if (packageManager === 'apk') {
      writeToStdout('Claude 由 apk 管理。\n')
      const latest = await getLatestVersion(channel)
      if (latest && !gte(MACRO.VERSION, latest)) {
        writeToStdout(`有更新可用: ${MACRO.VERSION} → ${latest}\n`)
        writeToStdout('\n')
        writeToStdout('要更新，请运行:\n')
        writeToStdout(chalk.bold('  apk upgrade claude-code') + '\n')
      } else {
        writeToStdout('Claude 已是最新版本!\n')
      }
    } else {
      // pacman, deb, and rpm don't get specific commands because they each have
      // multiple frontends (pacman: yay/paru/makepkg, deb: apt/apt-get/aptitude/nala,
      // rpm: dnf/yum/zypper)
      writeToStdout('Claude 由包管理器管理。\n')
      writeToStdout('请使用您的包管理器进行更新。\n')
    }

    await gracefulShutdown(0)
  }

  // 检查配置/实际安装不匹配（跳过包管理器安装）
  if (
    config.installMethod &&
    diagnostic.configInstallMethod !== 'not set' &&
    diagnostic.installationType !== 'package-manager'
  ) {
    const runningType = diagnostic.installationType
    const configExpects = diagnostic.configInstallMethod

    // Map installation types for comparison
    const typeMapping: Record<string, string> = {
      'npm-local': 'local',
      'npm-global': 'global',
      native: 'native',
      development: 'development',
      unknown: 'unknown',
    }

    const normalizedRunningType = typeMapping[runningType] || runningType

    if (
      normalizedRunningType !== configExpects &&
      configExpects !== 'unknown'
    ) {
      writeToStdout('\n')
      writeToStdout(chalk.yellow('警告: 配置不匹配') + '\n')
      writeToStdout(`配置期望: ${configExpects} 安装\n`)
      writeToStdout(`当前运行: ${runningType}\n`)
      writeToStdout(
        chalk.yellow(
          `正在更新您当前使用的 ${runningType} 安装`,
        ) + '\n',
      )

      // 更新配置以匹配实际情况
      saveGlobalConfig(current => ({
        ...current,
        installMethod: normalizedRunningType as InstallMethod,
      }))
      writeToStdout(
        `配置已更新以反映当前安装方式: ${normalizedRunningType}\n`,
      )
    }
  }

  // 首先处理原生安装更新
  if (diagnostic.installationType === 'native') {
    logForDebugging(
      'update: Detected native installation, using native updater',
    )
    try {
      const result = await installLatestNative(channel, true)

      // 优雅处理锁争用
      if (result.lockFailed) {
        const pidInfo = result.lockHolderPid
          ? ` (PID ${result.lockHolderPid})`
          : ''
        writeToStdout(
          chalk.yellow(
            `另一个 Claude 进程${pidInfo}正在运行。请稍后再试。`,
          ) + '\n',
        )
        await gracefulShutdown(0)
      }

      if (!result.latestVersion) {
        process.stderr.write('检查更新失败\n')
        await gracefulShutdown(1)
      }

      if (result.latestVersion === MACRO.VERSION) {
        writeToStdout(
          chalk.green(`Claude Code 已是最新版本 (${MACRO.VERSION})`) + '\n',
        )
      } else {
        writeToStdout(
          chalk.green(
            `成功从 ${MACRO.VERSION} 更新到版本 ${result.latestVersion}`,
          ) + '\n',
        )
        await regenerateCompletionCache()
      }
      await gracefulShutdown(0)
    } catch (error) {
      process.stderr.write('错误: 原生更新安装失败\n')
      process.stderr.write(String(error) + '\n')
      process.stderr.write('尝试运行 "claude doctor" 进行诊断\n')
      await gracefulShutdown(1)
    }
  }

  // 回退到现有的 JS/npm 基础更新逻辑
  // 删除原生安装程序符号链接，因为我们不使用原生安装
  // 但仅在用户尚未迁移到原生安装时
  if (config.installMethod !== 'native') {
    await removeInstalledSymlink()
  }

  logForDebugging('update: Checking npm registry for latest version')
  logForDebugging(`update: Package URL: ${MACRO.PACKAGE_URL}`)
  const npmTag = channel === 'stable' ? 'stable' : 'latest'
  const npmCommand = `npm view ${MACRO.PACKAGE_URL}@${npmTag} version`
  logForDebugging(`update: Running: ${npmCommand}`)
  const latestVersion = await getLatestVersion(channel)
  logForDebugging(
    `update: Latest version from npm: ${latestVersion || 'FAILED'}`,
  )

  if (!latestVersion) {
    logForDebugging('update: Failed to get latest version from npm registry')
    process.stderr.write(chalk.red('检查更新失败') + '\n')
    process.stderr.write('无法从 npm 注册表获取最新版本\n')
    process.stderr.write('\n')
    process.stderr.write('可能原因:\n')
    process.stderr.write('  • 网络连接问题\n')
    process.stderr.write('  • npm 注册表不可达\n')
    process.stderr.write('  • 企业代理/防火墙阻止 npm\n')
    if (MACRO.PACKAGE_URL && !MACRO.PACKAGE_URL.startsWith('@anthropic')) {
      process.stderr.write(
        '  • 内部/开发构建未发布到 npm\n',
      )
    }
    process.stderr.write('\n')
    process.stderr.write('尝试:\n')
    process.stderr.write('  • 检查您的互联网连接\n')
    process.stderr.write('  • 使用 --debug 标志运行以获取更多详细信息\n')
    const packageName =
      MACRO.PACKAGE_URL ||
      (process.env.USER_TYPE === 'ant'
        ? '@anthropic-ai/claude-cli'
        : '@anthropic-ai/claude-code')
    process.stderr.write(
      `  • 手动检查: npm view ${packageName} version\n`,
    )

    process.stderr.write('  • 检查是否需要登录: npm whoami\n')
    await gracefulShutdown(1)
  }

  // 检查版本是否完全匹配，包括任何构建元数据（如 SHA）
  if (latestVersion === MACRO.VERSION) {
    writeToStdout(
      chalk.green(`Claude Code 已是最新版本 (${MACRO.VERSION})`) + '\n',
    )
    await gracefulShutdown(0)
  }

  writeToStdout(
    `有新版本可用: ${latestVersion} (当前: ${MACRO.VERSION})\n`,
  )
  writeToStdout('正在安装更新...\n')

  // 根据实际运行情况确定更新方法
  let useLocalUpdate = false
  let updateMethodName = ''

  switch (diagnostic.installationType) {
    case 'npm-local':
      useLocalUpdate = true
      updateMethodName = 'local'
      break
    case 'npm-global':
      useLocalUpdate = false
      updateMethodName = 'global'
      break
    case 'unknown': {
      // 如果无法确定安装类型，则回退到检测
      const isLocal = await localInstallationExists()
      useLocalUpdate = isLocal
      updateMethodName = isLocal ? 'local' : 'global'
      writeToStdout(
        chalk.yellow('警告: 无法确定安装类型') + '\n',
      )
      writeToStdout(
        `正在根据文件检测尝试 ${updateMethodName} 更新...\n`,
      )
      break
    }
    default:
      process.stderr.write(
        `错误: 无法更新 ${diagnostic.installationType} 安装\n`,
      )
      await gracefulShutdown(1)
  }

  writeToStdout(`正在使用 ${updateMethodName} 安装更新方式...\n`)

  logForDebugging(`update: Update method determined: ${updateMethodName}`)
  logForDebugging(`update: useLocalUpdate: ${useLocalUpdate}`)

  let status: InstallStatus

  if (useLocalUpdate) {
    logForDebugging(
      'update: Calling installOrUpdateClaudePackage() for local update',
    )
    status = await installOrUpdateClaudePackage(channel)
  } else {
    logForDebugging('update: Calling installGlobalPackage() for global update')
    status = await installGlobalPackage()
  }

  logForDebugging(`update: Installation status: ${status}`)

  switch (status) {
    case 'success':
      writeToStdout(
        chalk.green(
          `成功从 ${MACRO.VERSION} 更新到版本 ${latestVersion}`,
        ) + '\n',
      )
      await regenerateCompletionCache()
      break
    case 'no_permissions':
      process.stderr.write(
        '错误: 安装更新权限不足\n',
      )
      if (useLocalUpdate) {
        process.stderr.write('尝试手动更新:\n')
        process.stderr.write(
          `  cd ~/.claude/local && npm update ${MACRO.PACKAGE_URL}\n`,
        )
      } else {
        process.stderr.write('尝试使用 sudo 运行或修复 npm 权限\n')
        process.stderr.write(
          '或者考虑使用原生安装: claude install\n',
        )
      }
      await gracefulShutdown(1)
      break
    case 'install_failed':
      process.stderr.write('错误: 更新安装失败\n')
      if (useLocalUpdate) {
        process.stderr.write('尝试手动更新:\n')
        process.stderr.write(
          `  cd ~/.claude/local && npm update ${MACRO.PACKAGE_URL}\n`,
        )
      } else {
        process.stderr.write(
          '或者考虑使用原生安装: claude install\n',
        )
      }
      await gracefulShutdown(1)
      break
    case 'in_progress':
      process.stderr.write(
        '错误: 另一个实例正在执行更新\n',
      )
      process.stderr.write('请等待稍后再试\n')
      await gracefulShutdown(1)
      break
  }
  await gracefulShutdown(0)
}
