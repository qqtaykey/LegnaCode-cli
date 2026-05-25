import type {
  ComputerUseHostAdapter,
  Logger,
} from './mcp/types.js'
import { execFile } from 'child_process'
import { format } from 'util'
import { logForDebugging } from '../debug.js'
import { COMPUTER_USE_MCP_SERVER_NAME } from './common.js'
import { createCliExecutor } from './executor.js'
import { getChicagoEnabled, getChicagoSubGates } from './gates.js'
import { callPythonBridge } from './pythonBridge.js'

// ── macOS permission check via Python bridge ────────────────────────────────
// The Python helper's `check_permissions` uses CGPreflightScreenCaptureAccess()
// with a window-title fallback probe. For child processes the preflight API is
// unreliable (returns false even when the parent app bundle is authorized), so
// we treat `null` (unknown) as non-blocking and let the actual capture attempt
// be the final source of truth.

async function checkMacPermissionsViaPython(): Promise<{ accessibility: boolean; screenRecording: boolean | null }> {
  try {
    return await callPythonBridge<{ accessibility: boolean; screenRecording: boolean | null }>('check_permissions')
  } catch (err) {
    logForDebugging(`[computer-use] Python permission check failed: ${err}`)
    // Fail-open: let the actual capture be the source of truth
    return { accessibility: true, screenRecording: null }
  }
}

class DebugLogger implements Logger {
  silly(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  debug(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'debug' })
  }
  info(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'info' })
  }
  warn(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'warn' })
  }
  error(message: string, ...args: unknown[]): void {
    logForDebugging(format(message, ...args), { level: 'error' })
  }
}

let cached: ComputerUseHostAdapter | undefined

/**
 * Process-lifetime singleton. Built once on first CU tool call.
 * Uses Python bridge instead of native modules — no degraded mode,
 * but requires Python + venv to be set up.
 */
export function getComputerUseHostAdapter(): ComputerUseHostAdapter {
  if (cached) return cached
  cached = {
    serverName: COMPUTER_USE_MCP_SERVER_NAME,
    logger: new DebugLogger(),
    executor: createCliExecutor({
      getMouseAnimationEnabled: () => getChicagoSubGates().mouseAnimation,
      getHideBeforeActionEnabled: () => getChicagoSubGates().hideBeforeAction,
    }),
    ensureOsPermissions: async () => {
      if (process.platform === 'win32') {
        return { granted: true }
      }

      if (process.platform === 'darwin') {
        const raw = await checkMacPermissionsViaPython()
        // null = child-process probe unreliable, treat as non-blocking
        const screenRecording = raw.screenRecording !== false
        const granted = raw.accessibility && screenRecording

        if (granted) {
          return { granted: true }
        }

        // Only open Settings for definitively-denied permissions
        if (!raw.accessibility) {
          execFile('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'])
        }
        if (raw.screenRecording === false) {
          execFile('open', ['x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'])
        }

        return { granted: false, accessibility: raw.accessibility, screenRecording }
      }

      // Unsupported platform
      return { granted: false, accessibility: false, screenRecording: false }
    },
    isDisabled: () => !getChicagoEnabled(),
    getSubGates: getChicagoSubGates,
    getAutoUnhideEnabled: () => true,
    // Pixel validation via Python PIL crop — returns null to skip for now.
    // The sub-gate defaults to false anyway.
    cropRawPatch: () => null,
  }
  return cached
}
