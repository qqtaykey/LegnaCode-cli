import * as fs from 'fs/promises'
import * as path from 'path'
import { getOriginalCwd } from '../../bootstrap/state.js'
import type { LocalCommandModule } from '../../types/command.js'

const mod: LocalCommandModule = {
  async call() {
    const cwd = getOriginalCwd()
    const workflowDir = path.join(cwd, '.claude', 'workflows')

    let entries: string[]
    try {
      entries = await fs.readdir(workflowDir)
    } catch {
      return { type: 'text', value: 'No .claude/workflows/ directory found.' }
    }

    const mdFiles = entries.filter(f => f.endsWith('.md'))
    if (mdFiles.length === 0) {
      return { type: 'text', value: 'No workflows found in .claude/workflows/' }
    }

    const lines = mdFiles.map(f => `  - ${f.replace(/\.md$/, '')}`)
    return {
      type: 'text',
      value: `Available workflows:\n${lines.join('\n')}`,
    }
  },
}

export { mod as default, mod }
export const call = mod.call
