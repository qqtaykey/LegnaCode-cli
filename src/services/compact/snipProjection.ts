import type { Message, SystemMessage } from '../../types/message.js'

/**
 * Check if a message is a snip boundary (carries snipMetadata with removedUuids).
 */
export function isSnipBoundaryMessage(msg: Message): boolean {
  return (
    msg.type === 'system' &&
    'snipMetadata' in msg &&
    (msg as SystemMessage).subtype === 'snip_boundary'
  )
}

/**
 * Project the model-facing view of messages by filtering out any messages
 * whose UUIDs appear in a snip boundary's removedUuids set.
 *
 * The REPL keeps full history for UI scrollback; this projection is applied
 * at query time so the model only sees the narrowed context.
 */
export function projectSnippedView<T extends Message>(messages: T[]): T[] {
  // Collect all removed UUIDs from snip boundary messages
  const removedUuids = new Set<string>()
  for (const msg of messages) {
    if (isSnipBoundaryMessage(msg) && 'snipMetadata' in msg) {
      const meta = (msg as Record<string, unknown>).snipMetadata as
        | { removedUuids?: string[] }
        | undefined
      if (meta?.removedUuids) {
        for (const uuid of meta.removedUuids) {
          removedUuids.add(uuid)
        }
      }
    }
  }

  if (removedUuids.size === 0) return messages

  // Filter out messages whose UUID is in the removed set
  return messages.filter(msg => {
    if ('uuid' in msg && typeof msg.uuid === 'string') {
      return !removedUuids.has(msg.uuid)
    }
    return true
  })
}
