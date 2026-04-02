import { getBridgeDebugHandle } from '../bridge/bridgeDebug.js'
import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'

/**
 * Ant-only: inject bridge failure states to manually test recovery paths.
 *
 *   /bridge-kick close 1002            — fire ws_closed with code 1002
 *   /bridge-kick close 1006            — fire ws_closed with code 1006
 *   /bridge-kick poll 404              — next poll throws 404/not_found_error
 *   /bridge-kick poll 404 <type>       — next poll throws 404 with error_type
 *   /bridge-kick poll 401              — next poll throws 401 (auth)
 *   /bridge-kick poll transient        — next poll throws axios-style rejection
 *   /bridge-kick register fail         — next register (inside doReconnect) transient-fails
 *   /bridge-kick register fail 3       — next 3 registers transient-fail
 *   /bridge-kick register fatal        — next register 403s (terminal)
 *   /bridge-kick reconnect-session fail — POST /bridge/reconnect fails (→ Strategy 2)
 *   /bridge-kick heartbeat 401         — next heartbeat 401s (JWT expired)
 *   /bridge-kick reconnect             — call doReconnect directly (= SIGUSR2)
 *   /bridge-kick status                — print current bridge state
 *
 * Workflow: connect Remote Control, run a subcommand, `tail -f debug.log`
 * and watch [bridge:repl] / [bridge:debug] lines for the recovery reaction.
 *
 * Composite sequences — the failure modes in the BQ data are chains, not
 * single events. Queue faults then fire the trigger:
 *
 *   # #22148 residual: ws_closed → register transient-blips → teardown?
 *   /bridge-kick register fail 2
 *   /bridge-kick close 1002
 *   → expect: doReconnect tries register, fails, returns false → teardown
 *     (demonstrates the retry gap that needs fixing)
 *
 *   # Dead gate: poll 404/not_found_error → does onEnvironmentLost fire?
 *   /bridge-kick poll 404
 *   → expect: tengu_bridge_repl_fatal_error (gate is dead — 147K/wk)
 *     after fix: tengu_bridge_repl_env_lost → doReconnect
 */

const USAGE = `/bridge-kick <子命令>
  close <code>              使用给定代码触发 ws_closed（例如 1002）
  poll <status> [type]      下一次 poll 抛出 BridgeFatalError(status, type)
  poll transient            下一次 poll 抛出 axios 风格的拒绝（5xx/网络）
  register fail [N]        下 N 次 register 失败（默认 1）
  register fatal            下一次 register 返回 403（终止）
  reconnect-session fail   下一次 POST /bridge/reconnect 失败
  heartbeat <status>       下一次 heartbeat 抛出 BridgeFatalError(status)
  reconnect                 直接调用 reconnectEnvironmentWithSession
  status                    打印 bridge 状态`

const call: LocalCommandCall = async args => {
  const h = getBridgeDebugHandle()
  if (!h) {
    return {
      type: 'text',
      value:
        '未注册 bridge debug handle。Remote Control 必须已连接（USER_TYPE=ant）。',
    }
  }

  const [sub, a, b] = args.trim().split(/\s+/)

  switch (sub) {
    case 'close': {
      const code = Number(a)
      if (!Number.isFinite(code)) {
        return { type: 'text', value: `close：需要数字代码\n${USAGE}` }
      }
      h.fireClose(code)
      return {
        type: 'text',
        value: `已触发 transport close(${code})。请查看 debug.log 中的 [bridge:repl] 恢复信息。`,
      }
    }

    case 'poll': {
      if (a === 'transient') {
        h.injectFault({
          method: 'pollForWork',
          kind: 'transient',
          status: 503,
          count: 1,
        })
        h.wakePollLoop()
        return {
          type: 'text',
          value:
            '下一次 poll 将抛出 transient（axios 拒绝）。Poll 循环已唤醒。',
        }
      }
      const status = Number(a)
      if (!Number.isFinite(status)) {
        return {
          type: 'text',
          value: `poll：需要 'transient' 或状态码\n${USAGE}`,
        }
      }
      // Default to what the server ACTUALLY sends for 404 (BQ-verified),
      // so `/bridge-kick poll 404` reproduces the real 147K/week state.
      const errorType =
        b ?? (status === 404 ? 'not_found_error' : 'authentication_error')
      h.injectFault({
        method: 'pollForWork',
        kind: 'fatal',
        status,
        errorType,
        count: 1,
      })
      h.wakePollLoop()
      return {
        type: 'text',
        value: `下一次 poll 将抛出 BridgeFatalError(${status}, ${errorType})。Poll 循环已唤醒。`,
      }
    }

    case 'register': {
      if (a === 'fatal') {
        h.injectFault({
          method: 'registerBridgeEnvironment',
          kind: 'fatal',
          status: 403,
          errorType: 'permission_error',
          count: 1,
        })
        return {
          type: 'text',
          value:
            '下一次 registerBridgeEnvironment 将返回 403。使用 close/reconnect 触发。',
        }
      }
      const n = Number(b) || 1
      h.injectFault({
        method: 'registerBridgeEnvironment',
        kind: 'transient',
        status: 503,
        count: n,
      })
      return {
        type: 'text',
        value: `接下来 ${n} 次 registerBridgeEnvironment 调用将 transient-fail。使用 close/reconnect 触发。`,
      }
    }

    case 'reconnect-session': {
      h.injectFault({
        method: 'reconnectSession',
        kind: 'fatal',
        status: 404,
        errorType: 'not_found_error',
        count: 2,
      })
      return {
        type: 'text',
        value:
          '接下来 2 次 POST /bridge/reconnect 调用将返回 404。doReconnect Strategy 1 将回退到 Strategy 2。',
      }
    }

    case 'heartbeat': {
      const status = Number(a) || 401
      h.injectFault({
        method: 'heartbeatWork',
        kind: 'fatal',
        status,
        errorType: status === 401 ? 'authentication_error' : 'not_found_error',
        count: 1,
      })
      return {
        type: 'text',
        value: `下一次 heartbeat 将返回 ${status}。请关注 onHeartbeatFatal → work-state 拆除。`,
      }
    }

    case 'reconnect': {
      h.forceReconnect()
      return {
        type: 'text',
        value: '已调用 reconnectEnvironmentWithSession()。请查看 debug.log。',
      }
    }

    case 'status': {
      return { type: 'text', value: h.describe() }
    }

    default:
      return { type: 'text', value: USAGE }
  }
}

const bridgeKick = {
  type: 'local',
  name: 'bridge-kick',
  description: '注入 bridge 故障状态以进行手动恢复测试',
  isEnabled: () => process.env.USER_TYPE === 'ant',
  supportsNonInteractive: false,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default bridgeKick
