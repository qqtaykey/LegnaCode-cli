/**
 * TerminalCaptureTool — captures visible content from the built-in
 * terminal panel (tmux pane). Gated by feature('TERMINAL_PANEL').
 */
import { spawnSync } from 'child_process'
import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import { getTerminalPanelSocket } from '../../utils/terminalPanel.js'
import { TERMINAL_CAPTURE_TOOL_NAME, DESCRIPTION, PROMPT } from './prompt.js'

const inputSchema = z.object({
  lines: z
    .number()
    .optional()
    .describe('Number of lines to capture (default: visible pane height)'),
})

export const TerminalCaptureTool = buildTool({
  name: TERMINAL_CAPTURE_TOOL_NAME,
  description: DESCRIPTION,
  searchHint: 'read terminal panel output',
  inputSchema,
  isReadOnly: () => true,
  isConcurrencySafe: () => true,
  prompt: () => PROMPT,
  userFacingName: () => 'Terminal Capture',
  renderToolUseMessage(input: z.infer<typeof inputSchema>) {
    return `Capturing terminal panel${input.lines ? ` (${input.lines} lines)` : ''}`
  },
  renderToolResultMessage(result: unknown) {
    return typeof result === 'string' ? result : JSON.stringify(result)
  },
  async call(input: z.infer<typeof inputSchema>) {
    const socket = getTerminalPanelSocket()
    const args = ['-L', socket, 'capture-pane', '-t', 'panel', '-p']
    if (input.lines) {
      args.push('-S', `-${input.lines}`)
    }

    const result = spawnSync('tmux', args, { encoding: 'utf-8' })

    if (result.status !== 0) {
      return {
        type: 'text' as const,
        text: 'Terminal panel is not active. Use Alt+J to open it first.',
      }
    }

    const output = result.stdout.trimEnd()
    if (!output) {
      return {
        type: 'text' as const,
        text: '(terminal panel is empty)',
      }
    }

    return {
      type: 'text' as const,
      text: output,
    }
  },
})
