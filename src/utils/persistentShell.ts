/**
 * Persistent Shell — reuses a single shell child process per session.
 *
 * Instead of spawning a new process for every command, keeps a shell alive
 * and sends commands via stdin, reading results via stdout/stderr.
 * Uses unique delimiters to separate command outputs.
 *
 * Benefits:
 * - Eliminates ~5-15ms spawn overhead per command
 * - Preserves environment variables set during session
 * - Supports CancellationToken (SIGINT without killing shell)
 */

import { spawn, type ChildProcess } from 'child_process'
import { randomBytes } from 'crypto'
import { findSuitableShell } from './Shell.js'
import { subprocessEnv } from './subprocessEnv.js'

const IDLE_TIMEOUT_MS = 60_000 // Kill shell after 60s idle
const MAX_SESSIONS = 4

export interface PersistentShellSession {
  id: string
  process: ChildProcess
  cwd: string
  busy: boolean
  lastUsed: number
  idleTimer: ReturnType<typeof setTimeout> | null
}

export interface ShellExecResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

const sessions = new Map<string, PersistentShellSession>()

function generateDelimiter(): string {
  return `__LEGNA_DELIM_${randomBytes(8).toString('hex')}__`
}

function resetIdleTimer(session: PersistentShellSession): void {
  if (session.idleTimer) clearTimeout(session.idleTimer)
  session.idleTimer = setTimeout(() => {
    destroySession(session.id)
  }, IDLE_TIMEOUT_MS)
}

/**
 * Create or retrieve a persistent shell session.
 */
export async function getOrCreateSession(
  id: string,
  cwd: string,
  env?: Record<string, string>,
): Promise<PersistentShellSession> {
  const existing = sessions.get(id)
  if (existing && existing.process.exitCode === null) {
    resetIdleTimer(existing)
    return existing
  }

  // Evict oldest if at capacity
  if (sessions.size >= MAX_SESSIONS) {
    let oldest: PersistentShellSession | null = null
    for (const s of sessions.values()) {
      if (!s.busy && (!oldest || s.lastUsed < oldest.lastUsed)) {
        oldest = s
      }
    }
    if (oldest) destroySession(oldest.id)
  }

  const shellPath = await findSuitableShell()
  const proc = spawn(shellPath, ['--norc', '--noprofile', '-i'], {
    cwd,
    env: { ...subprocessEnv(), ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const session: PersistentShellSession = {
    id,
    process: proc,
    cwd,
    busy: false,
    lastUsed: Date.now(),
    idleTimer: null,
  }

  proc.on('exit', () => {
    sessions.delete(id)
    if (session.idleTimer) clearTimeout(session.idleTimer)
  })

  sessions.set(id, session)
  resetIdleTimer(session)
  return session
}

/**
 * Execute a command in a persistent shell session.
 * Uses delimiter-based output separation.
 */
export async function execInSession(
  sessionId: string,
  command: string,
  options?: { timeoutMs?: number; cwd?: string },
): Promise<ShellExecResult> {
  const session = sessions.get(sessionId)
  if (!session || session.process.exitCode !== null) {
    throw new Error(`Shell session "${sessionId}" not found or dead.`)
  }

  if (session.busy) {
    throw new Error(`Shell session "${sessionId}" is busy.`)
  }

  session.busy = true
  session.lastUsed = Date.now()
  resetIdleTimer(session)

  const startDelim = generateDelimiter()
  const endDelim = generateDelimiter()
  const startTime = Date.now()

  // Change cwd if requested
  const cdPrefix = options?.cwd ? `cd ${JSON.stringify(options.cwd)} && ` : ''

  // Wrap command to capture exit code and delimit output
  const wrappedCommand = [
    `echo ${startDelim}`,
    `${cdPrefix}${command}`,
    `__legna_ec=$?`,
    `echo ""`,
    `echo "${endDelim} $__legna_ec"`,
  ].join('\n')

  return new Promise<ShellExecResult>((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let resolved = false

    const timeoutMs = options?.timeoutMs ?? 30_000
    const timer = setTimeout(() => {
      timedOut = true
      // Send SIGINT to interrupt current command, not kill shell
      session.process.kill('SIGINT')
    }, timeoutMs)

    const onStdout = (chunk: Buffer | string) => {
      stdout += chunk.toString()
      tryResolve()
    }

    const onStderr = (chunk: Buffer | string) => {
      stderr += chunk.toString()
    }

    const cleanup = () => {
      clearTimeout(timer)
      session.process.stdout?.removeListener('data', onStdout)
      session.process.stderr?.removeListener('data', onStderr)
      session.busy = false
    }

    const tryResolve = () => {
      if (resolved) return

      // Look for end delimiter with exit code
      const endIdx = stdout.indexOf(endDelim)
      if (endIdx === -1) return

      resolved = true
      cleanup()

      // Parse exit code from end delimiter line
      const afterDelim = stdout.slice(endIdx + endDelim.length).trim()
      const exitCode = parseInt(afterDelim, 10) || 0

      // Extract actual output between start and end delimiters
      const startIdx = stdout.indexOf(startDelim)
      let output = ''
      if (startIdx !== -1) {
        output = stdout.slice(startIdx + startDelim.length + 1, endIdx)
        // Remove trailing newline added by echo
        if (output.endsWith('\n')) output = output.slice(0, -1)
      }

      resolve({
        exitCode: timedOut ? 130 : exitCode,
        stdout: output,
        stderr,
        durationMs: Date.now() - startTime,
        timedOut,
      })
    }

    session.process.stdout?.on('data', onStdout)
    session.process.stderr?.on('data', onStderr)

    // Send the wrapped command
    session.process.stdin?.write(wrappedCommand + '\n')
  })
}

/**
 * Destroy a persistent shell session.
 */
export function destroySession(id: string): void {
  const session = sessions.get(id)
  if (!session) return

  if (session.idleTimer) clearTimeout(session.idleTimer)
  sessions.delete(id)

  if (session.process.exitCode === null) {
    session.process.kill('SIGTERM')
    // Force kill after 2s if still alive
    setTimeout(() => {
      if (session.process.exitCode === null) {
        session.process.kill('SIGKILL')
      }
    }, 2000)
  }
}

/**
 * Destroy all sessions (cleanup on process exit).
 */
export function destroyAllSessions(): void {
  for (const id of sessions.keys()) {
    destroySession(id)
  }
}

/**
 * Check if persistent shell is available (always true for TS impl).
 */
export function isPersistentShellAvailable(): boolean {
  return true
}

/**
 * Get active session count.
 */
export function getActiveSessionCount(): number {
  return sessions.size
}

// Cleanup on process exit
process.on('exit', destroyAllSessions)
process.on('SIGINT', destroyAllSessions)
process.on('SIGTERM', destroyAllSessions)
