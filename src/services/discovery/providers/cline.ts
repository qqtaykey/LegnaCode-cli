/**
 * Cline provider — reads rules from .clinerules file or directory.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CapabilityType, DiscoveredItem, DiscoveryProvider } from '../index.js'

export const ClineProvider: DiscoveryProvider = {
  id: 'cline',
  displayName: 'Cline',
  priority: 40,

  async load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = []

    if (capability === 'rules') {
      const clinerules = path.join(cwd, '.clinerules')

      if (fs.existsSync(clinerules)) {
        const stat = fs.statSync(clinerules)
        if (stat.isFile()) {
          // Single file
          try {
            const content = fs.readFileSync(clinerules, 'utf-8')
            items.push({
              type: 'rules',
              content: { name: 'clinerules', content, alwaysApply: true },
              source: { provider: 'cline', file: clinerules, priority: 40 },
            })
          } catch {}
        } else if (stat.isDirectory()) {
          // Directory of rule files
          const files = fs.readdirSync(clinerules).filter(f => f.endsWith('.md') || f.endsWith('.txt'))
          for (const file of files) {
            try {
              const content = fs.readFileSync(path.join(clinerules, file), 'utf-8')
              items.push({
                type: 'rules',
                content: { name: file.replace(/\.(md|txt)$/, ''), content, alwaysApply: true },
                source: { provider: 'cline', file: path.join(clinerules, file), priority: 40 },
              })
            } catch {}
          }
        }
      }
    }

    return items
  },
}
