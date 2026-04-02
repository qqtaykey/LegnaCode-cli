import React from 'react'
import type { DeepImmutable } from '../../types/utils.js'
import { useElapsedTime } from '../../hooks/useElapsedTime.js'
import type { KeyboardEvent } from '../../ink/events/keyboard-event.js'
import { Box, Text } from '../../ink.js'
import { useKeybindings } from '../../keybindings/useKeybinding.js'
import type { MonitorMcpTaskState } from '../../tasks/MonitorMcpTask/MonitorMcpTask.js'
import { Byline } from '../design-system/Byline.js'
import { Dialog } from '../design-system/Dialog.js'
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint.js'

type Props = {
  task: DeepImmutable<MonitorMcpTaskState>
  onDone?: () => void
  onBack?: () => void
  onKill?: () => void
}

export function MonitorMcpDetailDialog({
  task,
  onDone,
  onBack,
  onKill,
}: Props): React.ReactNode {
  const elapsedTime = useElapsedTime(
    task.startTime,
    task.status === 'running',
    1000,
    0,
  )

  const dismiss = onDone ?? onBack ?? (() => {})

  useKeybindings(
    { 'confirm:yes': dismiss },
    { context: 'Confirmation' },
  )

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === ' ') {
      e.preventDefault()
      dismiss()
    } else if (e.key === 'left' && onBack) {
      e.preventDefault()
      onBack()
    } else if (e.key === 'x' && task.status === 'running' && onKill) {
      e.preventDefault()
      onKill()
    }
  }

  const lastPing = task.lastPingTime
    ? new Date(task.lastPingTime).toLocaleTimeString()
    : 'never'

  return (
    <Box flexDirection="column" tabIndex={0} autoFocus onKeyDown={handleKeyDown}>
      <Dialog
        title="MCP Monitor"
        subtitle={
          <Text dimColor>
            {elapsedTime} · {task.serverName ?? 'all servers'}
          </Text>
        }
        onCancel={dismiss}
        color="background"
        inputGuide={exitState =>
          exitState.pending ? (
            <Text>Press {exitState.keyName} again to exit</Text>
          ) : (
            <Byline>
              {onBack && (
                <KeyboardShortcutHint shortcut={'\u2190'} action="go back" />
              )}
              <KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />
              {task.status === 'running' && onKill && (
                <KeyboardShortcutHint shortcut="x" action="stop" />
              )}
            </Byline>
          )
        }
      >
        <Box flexDirection="column" gap={1}>
          <Text>
            <Text bold>Status:</Text>{' '}
            {task.status === 'running' ? (
              <Text color="background">running</Text>
            ) : task.status === 'completed' ? (
              <Text color="success">{task.status}</Text>
            ) : (
              <Text color="error">{task.status}</Text>
            )}
          </Text>
          <Text>
            <Text bold>Server:</Text>{' '}
            {task.serverName ?? 'all'}
          </Text>
          <Text>
            <Text bold>Last ping:</Text>{' '}
            {lastPing}
          </Text>
          {task.lastStatus && (
            <Text dimColor>{task.lastStatus}</Text>
          )}
        </Box>
      </Dialog>
    </Box>
  )
}
