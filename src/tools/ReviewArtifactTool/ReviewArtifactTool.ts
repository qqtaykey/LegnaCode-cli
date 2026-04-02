/**
 * ReviewArtifactTool — allows the model to review code artifacts
 * (diffs, files) with structured feedback. Gated by REVIEW_ARTIFACT.
 */
import { z } from 'zod'
import { buildTool } from '../../Tool.js'

const inputSchema = z.object({
  artifact_type: z.enum(['diff', 'file', 'snippet']).describe('Type of artifact to review'),
  path: z.string().describe('File path of the artifact'),
  feedback: z.string().describe('Review feedback or comments'),
})

export const ReviewArtifactTool = buildTool({
  name: 'ReviewArtifact',
  description: 'Review a code artifact and provide structured feedback',
  inputSchema,
  async call(input, context) {
    return {
      type: 'text' as const,
      text: `Reviewed ${input.artifact_type} at ${input.path}: ${input.feedback}`,
    }
  },
  renderToolUseMessage(input) {
    return `Reviewing ${input.artifact_type}: ${input.path}`
  },
  renderToolResultMessage(result) {
    return typeof result === 'string' ? result : JSON.stringify(result)
  },
  isReadOnly() {
    return true
  },
  userFacingName() {
    return 'ReviewArtifact'
  },
})
