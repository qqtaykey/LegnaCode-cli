/**
 * HashlineEditTool — hash-anchored file editing tool.
 * Uses xxHash32-based line anchors for precise edits without reproducing original text.
 */

import { isAbsolute } from 'path'
import type { ToolUseContext } from '../../Tool.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { getCwd } from '../../utils/cwd.js'
import { expandPath } from '../../utils/path.js'
import { checkWritePermissionForTool } from '../../utils/permissions/filesystem.js'
import type { PermissionDecision } from '../../utils/permissions/PermissionResult.js'
import { HASHLINE_EDIT_TOOL_NAME } from './constants.js'
import { executeHashlineEdit } from './execute.js'
import { hashlineEditPrompt } from './prompt.js'
import { hashlineEditParamsSchema, type HashlineParams } from './types.js'

export const HashlineEditTool: ToolDef<typeof hashlineEditParamsSchema> = buildTool({
  name: HASHLINE_EDIT_TOOL_NAME,
  description: hashlineEditPrompt,
  inputSchema: hashlineEditParamsSchema,
  async call(
    input: HashlineParams,
    context: ToolUseContext,
  ): Promise<{ text: string }> {
    const cwd = getCwd()
    const result = await executeHashlineEdit(input.input, cwd, input.path)

    if (!result.success) {
      return { text: `Error: ${result.message}` }
    }

    const parts: string[] = []
    if (result.message) parts.push(result.message)
    if (result.warnings && result.warnings.length > 0) {
      parts.push(`Warnings:\n${result.warnings.join('\n')}`)
    }
    if (result.diff) parts.push(result.diff)

    return { text: parts.join('\n\n') }
  },
  isReadOnly() {
    return false
  },
  userFacingName() {
    return 'Hashline Edit'
  },
  async checkPermission(
    input: HashlineParams,
    context: ToolUseContext,
  ): Promise<PermissionDecision> {
    // Extract file paths from input to check write permissions
    const cwd = getCwd()
    const pathToCheck = input.path
      ? (isAbsolute(input.path) ? input.path : expandPath(input.path, cwd))
      : cwd

    return checkWritePermissionForTool(pathToCheck, context)
  },
})
