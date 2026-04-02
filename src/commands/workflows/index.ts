import type { Command } from '../../types/command.js'

const workflows = {
  type: 'local',
  name: 'workflows',
  description: 'List available workflows',
  supportsNonInteractive: true,
  load: () => import('./workflows.js'),
} satisfies Command

export default workflows
