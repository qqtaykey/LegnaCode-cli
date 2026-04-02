/**
 * Permission request UI for ReviewArtifactTool.
 */
import * as React from 'react'
import { Box, Text } from '../../../ink.js'

export function ReviewArtifactPermissionRequest({
  toolInput,
  onAllow,
  onDeny,
}: {
  toolInput: { artifact_type?: string; path?: string; feedback?: string }
  onAllow: () => void
  onDeny: () => void
}): React.ReactNode {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>Review Artifact</Text>
      <Text dimColor>Type: {toolInput.artifact_type ?? 'unknown'}</Text>
      <Text dimColor>Path: {toolInput.path ?? 'unknown'}</Text>
    </Box>
  )
}
