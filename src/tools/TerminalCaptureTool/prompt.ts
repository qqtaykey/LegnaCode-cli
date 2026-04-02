export const TERMINAL_CAPTURE_TOOL_NAME = 'TerminalCapture'

export const DESCRIPTION =
  'Capture the current content of the built-in terminal panel (Alt+J). ' +
  'Returns the visible text from the tmux pane, useful for reading command ' +
  'output that the user ran in the terminal panel.'

export const PROMPT = `Use this tool to read the current visible content of the user's terminal panel. The terminal panel is a persistent shell session (Alt+J) running alongside the conversation. This tool captures whatever is currently displayed in that terminal — command output, logs, error messages, etc.

Only use this tool when:
- The user asks you to look at their terminal output
- You need to see the result of a command the user ran in the terminal panel
- The user references something visible in their terminal

Do NOT use this tool to run commands — use the Bash tool for that.`
