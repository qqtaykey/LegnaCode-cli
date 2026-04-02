/**
 * Task summary generator — periodically summarizes what the agent is
 * working on for `legna ps` display. Gated by feature('BG_SESSIONS').
 */
import { logForDebugging } from './debug.js'
import { updateSessionActivity } from './concurrentSessions.js'

let lastSummaryTime = 0
const SUMMARY_INTERVAL_MS = 30_000 // Generate at most every 30s

/**
 * Check if enough time has passed to generate a new summary.
 */
export function shouldGenerateTaskSummary(): boolean {
  return Date.now() - lastSummaryTime > SUMMARY_INTERVAL_MS
}

/**
 * Fire-and-forget summary generation. Updates the PID file's
 * waitingFor/status fields so `legna ps` can show current activity.
 */
export function maybeGenerateTaskSummary(params: {
  systemPrompt: string
  userContext: Record<string, string>
  systemContext: Record<string, string>
  toolUseContext: unknown
  forkContextMessages: unknown[]
}): void {
  lastSummaryTime = Date.now()

  // Extract a simple summary from the last few messages
  const messages = params.forkContextMessages
  const lastMsg = messages[messages.length - 1] as any
  const summary = lastMsg?.message?.content
    ? typeof lastMsg.message.content === 'string'
      ? lastMsg.message.content.slice(0, 100)
      : Array.isArray(lastMsg.message.content)
        ? lastMsg.message.content
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join(' ')
            .slice(0, 100)
        : 'working...'
    : 'working...'

  void updateSessionActivity({ waitingFor: summary }).catch(e => {
    logForDebugging(`[taskSummary] failed to update activity: ${e}`)
  })
}
