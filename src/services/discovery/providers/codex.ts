/**
 * OpenAI Codex provider — reads context from .codex/ directories.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CapabilityType, DiscoveredItem, DiscoveryProvider } from '../index.js'

export const CodexProvider: DiscoveryProvider = {
  id: 'codex',
  displayName: 'OpenAI Codex',
  priority: 70,

  async load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = []
    const localDir = path.join(cwd, '.codex')

    if (capability === 'mcps') {
      const mcpFile = path.join(localDir, 'mcp.json')
      if (fs.existsSync(mcpFile)) {
        try {
          const data = JSON.parse(fs.readFileSync(mcpFile, 'utf-8'))
          const servers = data.mcpServers ?? data.servers ?? {}
          for (const [name, config] of Object.entries(servers)) {
            items.push({
              type: 'mcps',
              content: { name, ...(config as any) },
              source: { provider: 'codex', file: mcpFile, priority: 70 },
            })
          }
        } catch {}
      }
    }

    if (capability === 'rules' || capability === 'context') {
      // AGENTS.md context file
      const agentsFile = path.join(localDir, 'AGENTS.md')
      if (fs.existsSync(agentsFile)) {
        try {
          const content = fs.readFileSync(agentsFile, 'utf-8')
          items.push({
            type: 'rules',
            content: { name: 'AGENTS', content, alwaysApply: true },
            source: { provider: 'codex', file: agentsFile, priority: 70 },
          })
        } catch {}
      }
    }

    return items
  },
}
