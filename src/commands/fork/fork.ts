import type { LocalCommandResult } from '../../types/command.js'

export async function call(args: string): Promise<LocalCommandResult> {
  const directive = args.trim()
  if (!directive) {
    return {
      type: 'text',
      value: 'Usage: /fork <directive>\nExample: /fork investigate the failing test in src/utils/',
    }
  }
  // The actual fork is handled by the REPL's onSubmit path — the slash
  // command just validates args and returns the directive as a user message
  // that the query loop picks up. The Agent tool's fork path in runAgent.ts
  // handles the real orchestration.
  return {
    type: 'text',
    value: `Forking sub-agent with directive: ${directive}`,
  }
}
