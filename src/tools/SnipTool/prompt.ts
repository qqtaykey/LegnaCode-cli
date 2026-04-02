export const SNIP_TOOL_NAME = 'SnipTool' as const

export const SNIP_TOOL_PROMPT = `The SnipTool removes old messages from the model's visible context to free up space in the context window.
- Snipped messages are preserved in the UI for the user to scroll back through, but they are hidden from the model's view.
- Use this tool when the context window is getting full and older messages are no longer relevant to the current task.
- You can snip specific messages by ID, or a range of messages.
- If no message_ids or range is provided, the tool will automatically select old messages to remove.
- Snipping is non-destructive: the user retains full history, only the model's view is narrowed.`
