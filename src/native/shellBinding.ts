/**
 * Native Shell TypeScript binding — wraps Rust brush-shell addon with process fallback.
 *
 * Uses vendored brush-shell (Rust bash interpreter) for in-process shell execution.
 * Supports persistent sessions and output minimization.
 * Falls back to spawning shell processes when native addon is unavailable.
 */

import {
  shellAddon,
  hasNativeShell,
  type NativeShellOptions,
  type NativeShellResult,
} from './index.js'

export interface ShellExecOptions {
  command: string
  cwd?: string
  env?: Record<string, string>
  timeoutMs?: number
}

export interface ShellExecResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  truncated: boolean
}

// Session management for persistent shell instances
const _sessions = new Map<string, number>()

/**
 * Create a persistent shell session.
 * Returns a session ID that can be used with executeInSession.
 */
export function createShellSession(id: string, cwd: string): boolean {
  if (!hasNativeShell || !shellAddon) return false

  const sessionId = shellAddon.createSession(cwd)
  _sessions.set(id, sessionId)
  return true
}

/**
 * Execute a command in a persistent shell session.
 * Returns null if native shell is unavailable or session doesn't exist.
 */
export function executeInSession(
  sessionId: string,
  command: string,
  timeoutMs?: number,
): ShellExecResult | null {
  if (!hasNativeShell || !shellAddon) return null

  const nativeId = _sessions.get(sessionId)
  if (nativeId === undefined) return null

  const result: NativeShellResult = shellAddon.executeInSession(nativeId, command, timeoutMs)
  return {
    exitCode: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.duration_ms,
    truncated: result.truncated,
  }
}

/**
 * Destroy a persistent shell session.
 */
export function destroyShellSession(id: string): void {
  if (!hasNativeShell || !shellAddon) return

  const nativeId = _sessions.get(id)
  if (nativeId !== undefined) {
    shellAddon.destroySession(nativeId)
    _sessions.delete(id)
  }
}

/**
 * Execute a one-shot command (no persistent session).
 * Returns null if native shell is unavailable.
 */
export function nativeShellExec(options: ShellExecOptions): ShellExecResult | null {
  if (!hasNativeShell || !shellAddon) return null

  const nativeOpts: NativeShellOptions = {
    command: options.command,
    cwd: options.cwd,
    env: options.env,
    timeout_ms: options.timeoutMs,
  }

  const result: NativeShellResult = shellAddon.executeOneshot(nativeOpts)
  return {
    exitCode: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.duration_ms,
    truncated: result.truncated,
  }
}

/**
 * Check if native shell is available.
 */
export function isNativeShellAvailable(): boolean {
  return hasNativeShell
}
