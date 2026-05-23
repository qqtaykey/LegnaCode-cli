/**
 * Windsurf provider — reads MCP servers and rules from .windsurf/ directories.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CapabilityType, DiscoveredItem, DiscoveryProvider } from '../index.js'

export const WindsurfProvider: DiscoveryProvider = {
  id: 'windsurf',
  displayName: 'Windsurf',
  priority: 50,

  async load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = []
    const localDir = path.join(cwd, '.windsurf')
    const globalDir = path.join(process.env.HOME ?? '~', '.codeium', 'windsurf')

    if (capability === 'mcps') {
      for (const dir of [localDir, globalDir]) {
        const mcpFile = path.join(dir, 'mcp_config.json')
        if (!fs.existsSync(mcpFile)) continue
        try {
          const data = JSON.parse(fs.readFileSync(mcpFile, 'utf-8'))
          const servers = data.mcpServers ?? data.servers ?? {}
          for (const [name, config] of Object.entries(servers)) {
            items.push({
              type: 'mcps',
              content: { name, ...(config as any) },
              source: { provider: 'windsurf', file: mcpFile, priority: 50 },
            })
          }
        } catch {}
      }
    }

    if (capability === 'rules') {
      const rulesDir = path.join(localDir, 'rules')
      if (fs.existsSync(rulesDir)) {
        const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'))
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(rulesDir, file), 'utf-8')
            items.push({
              type: 'rules',
              content: { name: file.replace(/\.md$/, ''), content, alwaysApply: true },
              source: { provider: 'windsurf', file: path.join(rulesDir, file), priority: 50 },
            })
          } catch {}
        }
      }
    }

    return items
  },
}
