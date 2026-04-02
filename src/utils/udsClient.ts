/**
 * UDS (Unix Domain Socket) client — queries live sessions from PID files.
 * Used by conversationRecovery to skip live bg/daemon sessions on --continue.
 * Gated by feature('BG_SESSIONS').
 */
import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { getClaudeConfigHomeDir } from './envUtils.js'

function getSessionsDir(): string {
  return join(getClaudeConfigHomeDir(), 'sessions')
}

type LiveSession = {
  kind?: string
  sessionId?: string
}

/**
 * List all live sessions by reading PID files and checking process liveness.
 */
export async function listAllLiveSessions(): Promise<LiveSession[]> {
  const dir = getSessionsDir()
  try {
    const files = await readdir(dir)
    const sessions: LiveSession[] = []
    for (const f of files.filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(await readFile(join(dir, f), 'utf-8'))
        // Check if process is still alive
        try {
          process.kill(data.pid, 0)
        } catch {
          continue // Process dead, skip
        }
        sessions.push({ kind: data.kind, sessionId: data.sessionId })
      } catch {
        // Skip corrupt files
      }
    }
    return sessions
  } catch {
    return []
  }
}
