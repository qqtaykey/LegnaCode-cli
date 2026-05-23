/**
 * Shell Binding — pure TypeScript persistent shell.
 *
 * Replaces the Rust brush-shell N-API addon with a child-process-based
 * persistent shell that works out of the box on all platforms.
 */

import {
  getOrCreateSession,
  execInSession,
  destroySession as destroyPersistentSession,
  isPersistentShellAvailable,
  type ShellExecResult as PersistentResult,
} from '../utils/persistentShell.js'

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

// Session management
const _sessions = new Set<string>()

/**
 * Create a persistent shell session.
 * Pure TS — always available, no native addon needed.
 */
export async function createShellSession(id: string, cwd: string, env?: Record<string, string>): Promise<void> {
  await getOrCreateSession(id, cwd, env)
  _sessions.add(id)
}

/**
 * Execute a command in a persistent shell session.
 */
export async function executeInSession(
  sessionId: string,
  command: string,
  timeoutMs?: number,
): Promise<ShellExecResult> {
  const result: PersistentResult = await execInSession(sessionId, command, { timeoutMs })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
  }
}

/**
 * Destroy a persistent shell session.
 */
export function destroyShellSession(id: string): void {
  _sessions.delete(id)
  destroyPersistentSession(id)
}

/**
 * Execute a one-shot command (creates temp session, executes, destroys).
 */
export async function nativeShellExec(options: ShellExecOptions): Promise<ShellExecResult> {
  const tempId = `oneshot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  try {
    await getOrCreateSession(tempId, options.cwd ?? process.cwd(), options.env)
    const result = await execInSession(tempId, options.command, { timeoutMs: options.timeoutMs })
    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      timedOut: result.timedOut,
    }
  } finally {
    destroyPersistentSession(tempId)
  }
}

/**
 * Check if shell is available — always true for pure TS impl.
 */
export function isNativeShellAvailable(): boolean {
  return isPersistentShellAvailable()
}
