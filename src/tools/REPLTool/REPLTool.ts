/**
 * REPLTool — persistent Python code execution environment.
 * Gated by feature('PYTHON_KERNEL').
 */
import { z } from 'zod'
import { buildTool } from '../../Tool.js'
import { startKernel, executeCode, stopKernel, isKernelRunning } from './python/kernel.js'
import { getCwd } from '../../utils/cwd.js'

const REPL_TOOL_NAME = 'REPLTool'

const inputSchema = z.object({
  code: z.string().describe('Python code to execute'),
  reset: z.boolean().optional().describe('Reset the kernel session before executing'),
})

// Use a fixed session ID per CLI session
const SESSION_ID = `repl_${process.pid}`

export const REPLTool = buildTool({
  name: REPL_TOOL_NAME,
  description: 'Execute Python code in a persistent environment. Variables and imports persist across calls.',
  searchHint: 'python repl execute code run script',
  inputSchema,
  isReadOnly: () => false,
  prompt: () =>
    'Use this tool to execute Python code in a persistent session. ' +
    'Variables, imports, and state persist between calls. ' +
    'Useful for data analysis, calculations, file processing, and testing Python snippets. ' +
    'The environment auto-detects virtualenvs and conda environments.',
  userFacingName: () => 'Python REPL',
  renderToolUseMessage(input: z.infer<typeof inputSchema>) {
    const preview = input.code.split('\n')[0].slice(0, 60)
    return `Python: ${preview}${input.code.length > 60 ? '...' : ''}`
  },
  renderToolResultMessage(result: unknown) {
    if (typeof result === 'string') return result
    const r = result as { type?: string; text?: string }
    return r?.text ?? JSON.stringify(result)
  },
  async call(input: z.infer<typeof inputSchema>) {
    const cwd = getCwd()

    // Reset kernel if requested
    if (input.reset && isKernelRunning(SESSION_ID)) {
      await stopKernel(SESSION_ID)
    }

    // Start kernel if not running
    if (!isKernelRunning(SESSION_ID)) {
      try {
        await startKernel(SESSION_ID, cwd)
      } catch (e: any) {
        return { type: 'text' as const, text: `Failed to start Python kernel: ${e.message}` }
      }
    }

    // Execute code
    try {
      const response = await executeCode(SESSION_ID, input.code)

      if (response.type === 'error') {
        return { type: 'text' as const, text: `Error:\n${response.traceback ?? response.text ?? 'Unknown error'}` }
      }

      // Build output
      const parts: string[] = []
      if (response.text) parts.push(response.text)

      // Handle rich display (images etc)
      if (response.data) {
        for (const [mime, content] of Object.entries(response.data)) {
          if (mime === 'image/png' || mime === 'image/jpeg') {
            // Return as image block
            return {
              type: 'image' as const,
              source: { type: 'base64', media_type: mime, data: content },
            }
          }
          if (mime === 'text/plain') {
            parts.push(content)
          }
        }
      }

      return { type: 'text' as const, text: parts.join('\n') || '(no output)' }
    } catch (e: any) {
      return { type: 'text' as const, text: `Execution error: ${e.message}` }
    }
  },
})
