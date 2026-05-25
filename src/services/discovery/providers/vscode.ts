/**
 * VS Code provider — reads MCP servers from .vscode/mcp.json.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CapabilityType, DiscoveredItem, DiscoveryProvider } from '../index.js'

export const VSCodeProvider: DiscoveryProvider = {
  id: 'vscode',
  displayName: 'VS Code',
  priority: 20,

  async load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = []

    if (capability === 'mcps') {
      const mcpFile = path.join(cwd, '.vscode', 'mcp.json')
      if (!fs.existsSync(mcpFile)) return items
      try {
        const data = JSON.parse(fs.readFileSync(mcpFile, 'utf-8'))
        const servers = data.mcp?.servers ?? data.servers ?? data.mcpServers ?? {}
        for (const [name, config] of Object.entries(servers)) {
          items.push({
            type: 'mcps',
            content: { name, ...(config as any) },
            source: { provider: 'vscode', file: mcpFile, priority: 20 },
          })
        }
      } catch {}
    }

    return items
  },
}
