/**
 * 在 Claude 工作时防止 macOS 睡眠。
 *
 * 使用内置的 `caffeinate` 命令创建电源断言以防止空闲睡眠。
 * 这使 Mac 在 API 请求和工具执行期间保持清醒，
 * 长时间运行的操作不会中断。
 *
 * caffeinate 进程以超时启动并定期重启。
 * 这提供自愈行为：如果 Node 进程被 SIGKILL 杀死
 *（不运行清理处理程序），孤立的 caffeinate 将在
 * 超时到期后自动退出。
 *
 * 仅在 macOS 上运行 - 在其他平台上为无操作。
 */
import { type ChildProcess, spawn } from 'child_process'
import { registerCleanup } from '../utils/cleanupRegistry.js'
import { logForDebugging } from '../utils/debug.js'

// Caffeinate 超时秒数。进程此持续时间后自动退出。
// 我们在到期前重启它以保持连续的睡眠防止。
const CAFFEINATE_TIMEOUT_SECONDS = 300 // 5 分钟

// 重启间隔 - 在到期前重启 caffeinate。
// 使用 4 分钟以在 5 分钟超时之前提供充足的缓冲。
const RESTART_INTERVAL_MS = 4 * 60 * 1000

let caffeinateProcess: ChildProcess | null = null
let restartInterval: ReturnType<typeof setInterval> | null = null
let refCount = 0
let cleanupRegistered = false

/**
 * 增加引用计数并在需要时开始防止睡眠。
 * 在开始应该保持 Mac 清醒的工作时调用此函数。
 */
export function startPreventSleep(): void {
  refCount++

  if (refCount === 1) {
    spawnCaffeinate()
    startRestartInterval()
  }
}

/**
 * 减少引用计数，如果没有更多工作待处理则允许睡眠。
 * 工作完成时调用此函数。
 */
export function stopPreventSleep(): void {
  if (refCount > 0) {
    refCount--
  }

  if (refCount === 0) {
    stopRestartInterval()
    killCaffeinate()
  }
}

/**
 * 强制停止防止睡眠，不管引用计数如何。
 * 退出时用于清理。
 */
export function forceStopPreventSleep(): void {
  refCount = 0
  stopRestartInterval()
  killCaffeinate()
}

function startRestartInterval(): void {
  // 仅在 macOS 上运行
  if (process.platform !== 'darwin') {
    return
  }

  // 已在运行
  if (restartInterval !== null) {
    return
  }

  restartInterval = setInterval(() => {
    // 仅在仍需要防止睡眠时重启
    if (refCount > 0) {
      logForDebugging('重启 caffeinate 以保持睡眠防止')
      killCaffeinate()
      spawnCaffeinate()
    }
  }, RESTART_INTERVAL_MS)

  // 不要让 interval 保持 Node 进程存活
  restartInterval.unref()
}

function stopRestartInterval(): void {
  if (restartInterval !== null) {
    clearInterval(restartInterval)
    restartInterval = null
  }
}

function spawnCaffeinate(): void {
  // 仅在 macOS 上运行
  if (process.platform !== 'darwin') {
    return
  }

  // 已在运行
  if (caffeinateProcess !== null) {
    return
  }

  // 首次使用注册清理以确保退出时杀死 caffeinate
  if (!cleanupRegistered) {
    cleanupRegistered = true
    registerCleanup(async () => {
      forceStopPreventSleep()
    })
  }

  try {
    // -i: 创建断言以防止空闲睡眠
    //     这是最不激进的选择 - 显示器仍然可以睡眠
    // -t: 超时秒数 - caffeinate 在此之后自动退出
    //     这提供自愈行为如果 Node 被 SIGKILL 杀死
    caffeinateProcess = spawn(
      'caffeinate',
      ['-i', '-t', String(CAFFEINATE_TIMEOUT_SECONDS)],
      {
        stdio: 'ignore',
      },
    )

    // 不要让 caffeinate 保持 Node 进程存活
    caffeinateProcess.unref()

    const thisProc = caffeinateProcess
    caffeinateProcess.on('error', err => {
      logForDebugging(`caffeinate 产生错误：${err.message}`)
      if (caffeinateProcess === thisProc) caffeinateProcess = null
    })

    caffeinateProcess.on('exit', () => {
      if (caffeinateProcess === thisProc) caffeinateProcess = null
    })

    logForDebugging('启动 caffeinate 以防止睡眠')
  } catch {
    // 静默失败 - caffeinate 不可用或产生失败
    caffeinateProcess = null
  }
}

function killCaffeinate(): void {
  if (caffeinateProcess !== null) {
    const proc = caffeinateProcess
    caffeinateProcess = null
    try {
      // SIGKILL 用于立即终止 - SIGTERM 可能延迟
      proc.kill('SIGKILL')
      logForDebugging('停止 caffeinate，允许睡眠')
    } catch {
      // 进程可能已退出
    }
  }
}
