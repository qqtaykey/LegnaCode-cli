/**
 * Hunter skill — bundled skill for artifact review workflows.
 * Gated by REVIEW_ARTIFACT.
 */
import { registerBundledSkill } from '../bundledSkills.js'

export function registerHunterSkill(): void {
  registerBundledSkill({
    name: 'review',
    description: 'Review code changes and provide structured feedback',
    whenToUse:
      'When the user asks to review a diff, PR, or code changes. Provides structured artifact review with feedback.',
    argumentHint: '[file or diff path]',
    userInvocable: true,
    async getPromptForCommand(args) {
      const target = args.trim() || 'the most recent changes'
      return [
        {
          type: 'text',
          text: `Review ${target}. Use the ReviewArtifact tool to provide structured feedback on code quality, potential issues, and suggestions.`,
        },
      ]
    },
  })
}
