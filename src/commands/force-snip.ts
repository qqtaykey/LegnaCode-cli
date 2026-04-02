import type { Command } from '../commands.js'

const forceSnip = {
  type: 'local',
  name: 'force-snip',
  description: 'Force a history snip to free context',
  supportsNonInteractive: true,
  load: () => import('./force-snip-impl.js'),
} satisfies Command

export default forceSnip
