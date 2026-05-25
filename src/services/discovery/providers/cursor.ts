/**
 * Cursor provider — reads MCP servers and rules from .cursor/ directories.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { CapabilityType, DiscoveredItem, DiscoveryProvider } from '../index.js'

export const CursorProvider: DiscoveryProvider = {
  id: 'cursor',
  displayName: 'Cursor',
  priority: 50,

  async load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]> {
    const items: DiscoveredItem[] = []
    const localDir = path.join(cwd, '.cursor')
    const globalDir = path.join(process.env.HOME ?? '~', '.cursor')

    if (capability === 'mcps') {
      // Read MCP servers from mcp.json
      for (const dir of [localDir, globalDir]) {
        const mcpFile = path.join(dir, 'mcp.json')
        if (!fs.existsSync(mcpFile)) continue
        try {
          const data = JSON.parse(fs.readFileSync(mcpFile, 'utf-8'))
          const servers = data.mcpServers ?? data.servers ?? {}
          for (const [name, config] of Object.entries(servers)) {
            items.push({
              type: 'mcps',
              content: { name, ...(config as any) },
              source: { provider: 'cursor', file: mcpFile, priority: 50 },
            })
          }
        } catch {}
      }
    }

    if (capability === 'rules') {
      // Read rules from .cursor/rules/*.mdc and legacy .cursorrules
      const rulesDir = path.join(localDir, 'rules')
      if (fs.existsSync(rulesDir)) {
        const files = fs.readdirSync(rulesDir).filter(f => f.endsWith('.mdc') || f.endsWith('.md'))
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(rulesDir, file), 'utf-8')
            const { frontmatter, body } = parseMDC(content)
            items.push({
              type: 'rules',
              content: {
                name: file.replace(/\.(mdc|md)$/, ''),
                content: body,
                alwaysApply: frontmatter.alwaysApply,
                globs: frontmatter.globs,
                description: frontmatter.description,
              },
              source: { provider: 'cursor', file: path.join(rulesDir, file), priority: 50 },
            })
          } catch {}
        }
      }

      // Legacy .cursorrules
      const legacyFile = path.join(cwd, '.cursorrules')
      if (fs.existsSync(legacyFile)) {
        try {
          const content = fs.readFileSync(legacyFile, 'utf-8')
          items.push({
            type: 'rules',
            content: { name: 'cursorrules', content, alwaysApply: true },
            source: { provider: 'cursor', file: legacyFile, priority: 50 },
          })
        } catch {}
      }
    }

    return items
  },
}

function parseMDC(content: string): { frontmatter: any; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: content }

  const frontmatter: any = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    if (key && rest.length) {
      const value = rest.join(':').trim()
      if (value === 'true') frontmatter[key.trim()] = true
      else if (value === 'false') frontmatter[key.trim()] = false
      else if (value.startsWith('[')) {
        try { frontmatter[key.trim()] = JSON.parse(value) } catch { frontmatter[key.trim()] = value }
      } else frontmatter[key.trim()] = value
    }
  }
  return { frontmatter, body: match[2] }
}
