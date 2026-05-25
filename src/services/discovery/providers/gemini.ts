/**
 * Gemini CLI provider — reads MCP servers and context from .gemini/ directories.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CapabilityType, DiscoveredItem, DiscoveryProvider } from '../index.js'

export const GeminiProvider: DiscoveryProvider = {
  id: 'gemini',
  displayName: 'Gemini CLI',
  priority: 60,

  async load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = []
    const localDir = path.join(cwd, '.gemini')
    const globalDir = path.join(process.env.HOME ?? '~', '.gemini')

    if (capability === 'mcps') {
      for (const dir of [localDir, globalDir]) {
        const settingsFile = path.join(dir, 'settings.json')
        if (!fs.existsSync(settingsFile)) continue
        try {
          const data = JSON.parse(fs.readFileSync(settingsFile, 'utf-8'))
          const servers = data.mcpServers ?? {}
          for (const [name, config] of Object.entries(servers)) {
            items.push({
              type: 'mcps',
              content: { name, ...(config as any) },
              source: { provider: 'gemini', file: settingsFile, priority: 60 },
            })
          }
        } catch {}
      }
    }

    if (capability === 'rules' || capability === 'context') {
      // GEMINI.md context file
      const contextFile = path.join(localDir, 'GEMINI.md')
      if (fs.existsSync(contextFile)) {
        try {
          const content = fs.readFileSync(contextFile, 'utf-8')
          items.push({
            type: 'rules',
            content: { name: 'GEMINI', content, alwaysApply: true },
            source: { provider: 'gemini', file: contextFile, priority: 60 },
          })
        } catch {}
      }
    }

    return items
  },
}
