/**
 * GitHub Copilot provider — reads instructions from .github/copilot-instructions.md.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CapabilityType, DiscoveredItem, DiscoveryProvider } from '../index.js'

export const GitHubProvider: DiscoveryProvider = {
  id: 'github',
  displayName: 'GitHub Copilot',
  priority: 30,

  async load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = []

    if (capability === 'rules') {
      // .github/copilot-instructions.md
      const instructionsFile = path.join(cwd, '.github', 'copilot-instructions.md')
      if (fs.existsSync(instructionsFile)) {
        try {
          const content = fs.readFileSync(instructionsFile, 'utf-8')
          items.push({
            type: 'rules',
            content: { name: 'copilot-instructions', content, alwaysApply: true },
            source: { provider: 'github', file: instructionsFile, priority: 30 },
          })
        } catch {}
      }

      // .github/instructions/*.md
      const instructionsDir = path.join(cwd, '.github', 'instructions')
      if (fs.existsSync(instructionsDir)) {
        const files = fs.readdirSync(instructionsDir).filter(f => f.endsWith('.md'))
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(instructionsDir, file), 'utf-8')
            items.push({
              type: 'rules',
              content: { name: file.replace(/\.md$/, ''), content, alwaysApply: true },
              source: { provider: 'github', file: path.join(instructionsDir, file), priority: 30 },
            })
          } catch {}
        }
      }
    }

    return items
  },
}
