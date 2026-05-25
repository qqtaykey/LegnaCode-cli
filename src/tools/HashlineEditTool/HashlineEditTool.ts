/**
 * HashlineEditTool — hash-anchored file editing tool.
 * Uses xxHash32-based line anchors for precise edits without reproducing original text.
 */

import { isAbsolute } from 'path'
import { buildTool } from '../../Tool.js'
import { getCwd } from '../../utils/cwd.js'
import { expandPath } from '../../utils/path.js'
import { checkWritePermissionForTool } from '../../utils/permissions/filesystem.js'
import { HASHLINE_EDIT_TOOL_NAME } from './constants.js'
import { executeHashlineEdit } from './execute.js'
import { hashlineEditPrompt } from './prompt.js'
import { hashlineEditParamsSchema, type HashlineParams } from './types.js'

export const HashlineEditTool = buildTool({
  name: HASHLINE_EDIT_TOOL_NAME,
  maxResultSizeChars: 100_000,
  renderToolUseMessage(_input: any, _progress: any) {
    return null
  },
  async description() {
    return 'A tool for editing files using hash-anchored line references'
  },
  async prompt() {
    return hashlineEditPrompt
  },
  inputSchema: hashlineEditParamsSchema,
  async call(input: HashlineParams, _ctx: any, _canUse: any, _parent: any, _progress?: any) {
    const cwd = getCwd()
    const result = await executeHashlineEdit(input.input, cwd, input.path)

    if (!result.success) {
      return { data: `Error: ${result.message}` }
    }

    const parts: string[] = []
    if (result.message) parts.push(result.message)
    if (result.warnings && result.warnings.length > 0) {
      parts.push(`Warnings:\n${result.warnings.join('\n')}`)
    }
    if (result.diff) parts.push(result.diff)

    return { data: parts.join('\n\n') }
  },
  mapToolResultToToolResultBlockParam(output: string, toolUseID: string) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: output || 'Edit applied successfully.',
    }
  },
  isReadOnly() {
    return false
  },
  userFacingName() {
    return 'Hashline Edit'
  },
  async checkPermissions(input: HashlineParams, context: any): Promise<any> {
    const appState = context.getAppState()
    const cwd = getCwd()
    const pathToCheck = input.path
      ? (isAbsolute(input.path) ? input.path : expandPath(input.path, cwd))
      : cwd

    return checkWritePermissionForTool(
      HashlineEditTool as any,
      input,
      appState.toolPermissionContext,
      [pathToCheck],
    )
  },
})
