// Stub: assistant command — gated by feature('KAIROS')
// Minimal valid command so it doesn't crash getCommandName() when included.
import type { Command } from '../../types/command.js'

const assistant = {
  type: 'local-jsx',
  name: 'assistant',
  description: 'Attach to a running assistant session',
  isEnabled: () => false, // disabled until bridge infrastructure is available
  immediate: true,
  load: () =>
    Promise.resolve({
      async call(onDone: (msg: string, opts: { display: string }) => void) {
        onDone('Assistant viewer requires bridge infrastructure (not available in this build)', { display: 'system' })
        return null
      },
    }),
} satisfies Command

export default assistant
