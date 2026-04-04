import type { Command } from '../../types/command.js'

const migrate = {
  type: 'local',
  name: 'migrate',
  description: 'Migrate sessions and config from ~/.claude to project-local .legna/',
  isEnabled: () => true,
  supportsNonInteractive: true,
  load: () => import('./migrate.js'),
} satisfies Command

export default migrate
