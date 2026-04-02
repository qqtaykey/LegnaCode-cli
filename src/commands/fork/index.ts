import type { Command } from '../../commands.js'
import { isForkSubagentEnabled } from '../../tools/AgentTool/forkSubagent.js'

const fork = {
  type: 'local',
  name: 'fork',
  description: 'Fork a sub-agent with the current conversation context',
  isEnabled: () => isForkSubagentEnabled(),
  argumentHint: '<directive>',
  supportsNonInteractive: false,
  load: () => import('./fork.js'),
} satisfies Command

export default fork
