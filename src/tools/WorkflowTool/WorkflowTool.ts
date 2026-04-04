import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { WORKFLOW_TOOL_NAME } from './constants.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { getOriginalCwd } from '../../bootstrap/state.js'
import React from 'react'
import { Text } from '../../ink.js'

const inputSchema = z.object({
  workflow_name: z.string().describe('Name of the workflow to execute (without .md extension)'),
  args: z.optional(z.record(z.string(), z.string())).describe('Optional arguments to pass to the workflow'),
})

type Input = z.infer<typeof inputSchema>

export const WorkflowTool = buildTool({
  name: WORKFLOW_TOOL_NAME,
  inputSchema,
  maxResultSizeChars: 100_000,

  async description() {
    return 'Execute a workflow defined in .legna/workflows/'
  },

  async prompt() {
    return [
      `The ${WORKFLOW_TOOL_NAME} tool executes multi-step workflows defined as Markdown files in the .legna/workflows/ directory.`,
      'Each workflow file uses frontmatter for metadata (name, description) and Markdown body for step instructions.',
      'Use workflow_name to specify which workflow to run. Optionally pass args as key-value pairs.',
    ].join('\n')
  },

  async call(input: Input) {
    const cwd = getOriginalCwd()
    const workflowDir = path.join(cwd, '.legna', 'workflows')
    const filePath = path.join(workflowDir, `${input.workflow_name}.md`)

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return {
        data: content,
      }
    } catch {
      return {
        data: `Error: Workflow "${input.workflow_name}" not found at ${filePath}`,
      }
    }
  },

  renderToolUseMessage(input: Partial<Input>, _options) {
    return React.createElement(Text, null, input.workflow_name ?? 'workflow')
  },

  mapToolResultToToolResultBlockParam(content: string, toolUseID: string) {
    return {
      type: 'tool_result' as const,
      tool_use_id: toolUseID,
      content: [{ type: 'text' as const, text: String(content) }],
    }
  },
})
