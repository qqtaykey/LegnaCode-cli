/**
 * Native Shell TypeScript binding — wraps Rust brush-shell addon.
 *
 * Uses brush-shell (Rust bash interpreter) for in-process shell execution.
 * Supports persistent sessions. No fallback — if the native addon
 * is not compiled, this module throws at call time.
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
  timedOut: boolean
}

// Session management for persistent shell instances
const _sessions = new Map<string, number>()

/**
 * Create a persistent shell session.
 * Throws if native shell addon is not available.
 */
export function createShellSession(id: string, cwd: string, env?: Record<string, string>): void {
  if (!hasNativeShell || !shellAddon) {
    throw new Error(
      'Native shell addon not available. Run `cd native && cargo build --release` to compile, ' +
      'or disable NATIVE_SHELL feature flag in bunfig.toml.'
    )
  }

  const sessionId = shellAddon.createSession(cwd, env ?? null)
  _sessions.set(id, sessionId)
}

/**
 * Execute a command in a persistent shell session.
 * Throws if native shell is unavailable or session doesn't exist.
 */
export function executeInSession(
  sessionId: string,
  command: string,
  timeoutMs?: number,
): ShellExecResult {
  if (!hasNativeShell || !shellAddon) {
    throw new Error(
      'Native shell addon not available. Run `cd native && cargo build --release` to compile, ' +
      'or disable NATIVE_SHELL feature flag in bunfig.toml.'
    )
  }

  const nativeId = _sessions.get(sessionId)
  if (nativeId === undefined) {
    throw new Error(`Shell session "${sessionId}" not found. Call createShellSession first.`)
  }

  const result: NativeShellResult = shellAddon.executeInSession(nativeId, command, timeoutMs)
  return {
    exitCode: result.exit_code,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.duration_ms,
    timedOut: result.timed_out,
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
 * Throws if native shell is unavailable.
 */
export function nativeShellExec(options: ShellExecOptions): ShellExecResult {
  if (!hasNativeShell || !shellAddon) {
    throw new Error(
      'Native shell addon not available. Run `cd native && cargo build --release` to compile, ' +
      'or disable NATIVE_SHELL feature flag in bunfig.toml.'
    )
  }

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
    timedOut: result.timed_out,
  }
}

/**
 * Check if native shell is available.
 */
export function isNativeShellAvailable(): boolean {
  return hasNativeShell
}
