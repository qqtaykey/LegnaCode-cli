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

type REPLInput = z.infer<typeof inputSchema>

// Use a fixed session ID per CLI session
const SESSION_ID = `repl_${process.pid}`

export const REPLTool = buildTool({
  name: REPL_TOOL_NAME,
  maxResultSizeChars: 100_000,
  async description() {
    return 'Execute Python code in a persistent environment. Variables and imports persist across calls.'
  },
  async prompt() {
    return (
      'Use this tool to execute Python code in a persistent session. ' +
      'Variables, imports, and state persist between calls. ' +
      'Useful for data analysis, calculations, file processing, and testing Python snippets. ' +
      'The environment auto-detects virtualenvs and conda environments.'
    )
  },
  inputSchema,
  isReadOnly() {
    return false
  },
  userFacingName() {
    return 'Python REPL'
  },
  renderToolUseMessage(input: REPLInput) {
    const preview = input.code.split('\n')[0].slice(0, 60)
    return `Python: ${preview}${input.code.length > 60 ? '...' : ''}`
  },
  mapToolResultToToolResultBlockParam(output: string, toolUseID: string) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: output || '(no output)',
    }
  },
  async call(input: REPLInput, _ctx: any, _canUse: any, _parent: any, _progress?: any) {
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
        return { data: `Failed to start Python kernel: ${e.message}` }
      }
    }

    // Execute code
    try {
      const response = await executeCode(SESSION_ID, input.code)

      if (response.type === 'error') {
        return { data: `Error:\n${response.traceback ?? response.text ?? 'Unknown error'}` }
      }

      // Build output
      const parts: string[] = []
      if (response.text) parts.push(response.text)

      // Handle rich display (images etc)
      if (response.data) {
        for (const [mime, content] of Object.entries(response.data)) {
          if (mime === 'text/plain') {
            parts.push(content)
          }
        }
      }

      return { data: parts.join('\n') || '(no output)' }
    } catch (e: any) {
      return { data: `Execution error: ${e.message}` }
    }
  },
  async checkPermissions(_input: REPLInput, _context: any): Promise<any> {
    return { behavior: 'allow' as const, updatedInput: _input }
  },
})
