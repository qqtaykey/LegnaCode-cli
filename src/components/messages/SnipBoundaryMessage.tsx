import * as React from 'react'
import { Box, Text } from '../../ink.js'
import type { SystemMessage } from '../../types/message.js'

export function SnipBoundaryMessage({
  message,
}: {
  message: SystemMessage
}): React.ReactNode {
  const meta = 'snipMetadata' in message
    ? (message as Record<string, unknown>).snipMetadata as
        | { removedCount?: number; tokensFreed?: number }
        | undefined
    : undefined

  const countText = meta?.removedCount
    ? ` (${meta.removedCount} messages removed)`
    : ''

  return (
    <Box marginY={1}>
      <Text dimColor>--- History snipped ---{countText}</Text>
    </Box>
  )
}
