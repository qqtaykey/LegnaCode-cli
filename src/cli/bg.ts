/**
 * Background session CLI handlers — ps, logs, attach, kill, --bg.
 * Uses tmux for session persistence. Gated by feature('BG_SESSIONS').
 */
import { spawnSync } from 'child_process'
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'

function getSessionsDir(): string {
  return join(getClaudeConfigHomeDir(), 'sessions')
}

type PidEntry = {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  kind: string
  name?: string
  logPath?: string
  status?: string
  waitingFor?: string
}

async function readPidFiles(): Promise<PidEntry[]> {
  const dir = getSessionsDir()
  try {
    const files = await readdir(dir)
    const entries: PidEntry[] = []
    for (const f of files.filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(await readFile(join(dir, f), 'utf-8'))
        // Check if process is still alive
        try { process.kill(data.pid, 0) } catch { continue }
        entries.push(data)
      } catch { /* skip corrupt files */ }
    }
    return entries
  } catch {
    return []
  }
}

export async function psHandler(args: string[]): Promise<void> {
  const entries = await readPidFiles()
  if (entries.length === 0) {
    console.log('No active sessions.')
    return
  }
  console.log('Active sessions:')
  for (const e of entries) {
    const age = Math.round((Date.now() - e.startedAt) / 60000)
    const name = e.name ? ` (${e.name})` : ''
    const status = e.status ? ` [${e.status}]` : ''
    console.log(`  PID ${e.pid}${name}${status} — ${e.kind} — ${e.cwd} — ${age}m`)
  }
}

export async function logsHandler(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    console.log('Usage: legna logs <session-id or PID>')
    return
  }
  const entries = await readPidFiles()
  const entry = entries.find(e =>
    e.sessionId === sessionId ||
    String(e.pid) === sessionId ||
    e.name === sessionId,
  )
  if (!entry?.logPath) {
    console.log(`No log found for session: ${sessionId}`)
    return
  }
  try {
    const content = await readFile(entry.logPath, 'utf-8')
    console.log(content)
  } catch (e) {
    console.log(`Failed to read log: ${e}`)
  }
}

export async function attachHandler(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    console.log('Usage: legna attach <session-id or PID>')
    return
  }
  const entries = await readPidFiles()
  const entry = entries.find(e =>
    e.sessionId === sessionId ||
    String(e.pid) === sessionId ||
    e.name === sessionId,
  )
  if (!entry) {
    console.log(`Session not found: ${sessionId}`)
    return
  }
  // Try tmux attach
  const socket = `claude-bg-${entry.sessionId.slice(0, 8)}`
  const result = spawnSync('tmux', ['-L', socket, 'attach-session'], {
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.log(`Failed to attach to session ${sessionId}. It may not be a tmux session.`)
  }
}

export async function killHandler(sessionId: string | undefined): Promise<void> {
  if (!sessionId) {
    console.log('Usage: legna kill <session-id or PID>')
    return
  }
  const entries = await readPidFiles()
  const entry = entries.find(e =>
    e.sessionId === sessionId ||
    String(e.pid) === sessionId ||
    e.name === sessionId,
  )
  if (!entry) {
    console.log(`Session not found: ${sessionId}`)
    return
  }
  try {
    process.kill(entry.pid, 'SIGTERM')
    console.log(`Sent SIGTERM to PID ${entry.pid}`)
  } catch (e) {
    console.log(`Failed to kill PID ${entry.pid}: ${e}`)
  }
}

export async function handleBgFlag(args: string[]): Promise<void> {
  // --bg / --background: spawn a new background session via tmux
  const filteredArgs = args.filter(a => a !== '--bg' && a !== '--background')
  const name = filteredArgs.find(a => a.startsWith('--name='))?.split('=')[1]

  const exe = process.argv[0] ?? 'legna'
  const sessionSocket = `claude-bg-${Date.now().toString(36)}`

  const result = spawnSync('tmux', [
    '-L', sessionSocket,
    'new-session', '-d', '-s', 'main',
    exe, ...filteredArgs,
  ], { stdio: 'inherit' })

  if (result.status === 0) {
    console.log(`Background session started${name ? ` (${name})` : ''}`)
    console.log(`  Attach: legna attach ${sessionSocket}`)
    console.log(`  List:   legna ps`)
  } else {
    console.error('Failed to start background session. Is tmux installed?')
  }
}
