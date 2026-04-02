import React from 'react'
import type { DeepImmutable } from 'src/types/utils.js'
import { useElapsedTime } from '../../hooks/useElapsedTime.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'
import { Box, Text } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import type { LocalWorkflowTaskState } from '../../tasks/LocalWorkflowTask/LocalWorkflowTask.js'
import { Byline } from '../design-system/Byline.js'
import { Dialog } from '../design-system/Dialog.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'

type Props = {
  task: DeepImmutable<LocalWorkflowTaskState>
  onDone: () => void
  onBack?: () => void
  onKill?: () => void
  onSkip?: () => void
  onRetry?: () => void
}

export function WorkflowDetailDialog({
  task,
  onDone,
  onBack,
  onKill,
  onSkip,
  onRetry,
}: Props): React.ReactNode {
  const elapsedTime = useElapsedTime(
    task.startTime,
    task.status === 'running',
    1000,
    0,
  )

  useKeybindings(
    { 'confirm:yes': onDone },
    { context: 'Confirmation' },
  )

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault()
      onDone()
    } else if (e.key === 'left' && onBack) {
      e.preventDefault()
      onBack()
    } else if (e.key === 'x' && task.status === 'running' && onKill) {
      e.preventDefault()
      onKill()
    } else if (e.key === 's' && task.status === 'running' && onSkip) {
      e.preventDefault()
      onSkip()
    } else if (e.key === 'r' && task.status === 'failed' && onRetry) {
      e.preventDefault()
      onRetry()
    }
  }

  const statusLabel =
    task.status === 'running'
      ? 'Running'
      : task.status === 'completed'
        ? 'Completed'
        : task.status === 'failed'
          ? 'Failed'
          : task.status === 'killed'
            ? 'Killed'
            : 'Pending'

  const stepInfo =
    task.totalSteps != null
      ? ` (step ${(task.currentStep ?? 0) + 1}/${task.totalSteps})`
      : task.currentStep != null
        ? ` (step ${task.currentStep + 1})`
        : ''

  const elapsedSec = Math.floor(elapsedTime / 1000)

  return (
    <Dialog
      title={`Workflow: ${task.workflowName}`}
      onKeyDown={handleKeyDown}
    >
      <Box flexDirection="column" paddingX={1} paddingY={0}>
        <Box>
          <Text>
            Status: <Text bold>{statusLabel}</Text>
            {stepInfo}
          </Text>
        </Box>
        <Box>
          <Text dimColor>Elapsed: {elapsedSec}s</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Byline>
            {task.status === 'running' && onKill && (
              <KeyboardShortcutHint keys="x" label="kill" />
            )}
            {task.status === 'running' && onSkip && (
              <KeyboardShortcutHint keys="s" label="skip step" />
            )}
            {task.status === 'failed' && onRetry && (
              <KeyboardShortcutHint keys="r" label="retry" />
            )}
            {onBack && <KeyboardShortcutHint keys="←" label="back" />}
            <KeyboardShortcutHint keys="space" label="close" />
          </Byline>
        </Box>
      </Box>
    </Dialog>
  )
}
