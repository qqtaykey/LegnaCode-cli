import * as fs from 'fs/promises'
import * as path from 'path'
import { getOriginalCwd } from '../../bootstrap/state.js'
import type { Command } from '../../types/command.js'

/**
 * Parse simple YAML frontmatter from a markdown file.
 * Returns key-value pairs from the --- delimited block.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const result: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      result[key] = value
    }
  }
  return result
}

/**
 * Scan .claude/workflows/ for .md files and return a Command for each.
 */
export async function getWorkflowCommands(cwd: string): Promise<Command[]> {
  const workflowDir = path.join(cwd, '.legna', 'workflows')

  let entries: string[]
  try {
    entries = await fs.readdir(workflowDir)
  } catch {
    return []
  }

  const mdFiles = entries.filter(f => f.endsWith('.md'))
  const commands: Command[] = []

  for (const file of mdFiles) {
    const name = file.replace(/\.md$/, '')
    const filePath = path.join(workflowDir, file)

    let content: string
    try {
      content = await fs.readFile(filePath, 'utf-8')
    } catch {
      continue
    }

    const frontmatter = parseFrontmatter(content)
    const description = frontmatter['description'] ?? `Run the ${name} workflow`

    commands.push({
      type: 'prompt',
      name,
      description,
      hasUserSpecifiedDescription: !!frontmatter['description'],
      contentLength: content.length,
      progressMessage: `running ${name} workflow`,
      source: 'builtin',
      kind: 'workflow',
      loadedFrom: 'skills',
      async getPromptForCommand(_args, _context) {
        // Re-read at invocation time so edits are picked up
        const latest = await fs.readFile(filePath, 'utf-8')
        // Strip frontmatter for the prompt
        const body = latest.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
        return [{ type: 'text', text: body }]
      },
    })
  }

  return commands
}
