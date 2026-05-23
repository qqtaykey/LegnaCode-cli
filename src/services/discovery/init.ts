/**
 * Discovery initialization — registers all providers and exposes a single
 * entry point for the startup flow to call.
 *
 * Gated by feature('CONFIG_DISCOVERY') at the call site.
 */

import { registerProvider, loadCapability, setDisabledProviders } from './index.js'
import type { DiscoveredItem, DiscoveredMCPServer, DiscoveredRule } from './index.js'
import { CursorProvider } from './providers/cursor.js'
import { WindsurfProvider } from './providers/windsurf.js'
import { VSCodeProvider } from './providers/vscode.js'
import { GitHubProvider } from './providers/github.js'
import { GeminiProvider } from './providers/gemini.js'
import { CodexProvider } from './providers/codex.js'
import { ClineProvider } from './providers/cline.js'

let _initialized = false

/**
 * Register all built-in discovery providers. Idempotent.
 */
export function initDiscoveryProviders(): void {
  if (_initialized) return
  _initialized = true

  registerProvider(CursorProvider)
  registerProvider(WindsurfProvider)
  registerProvider(VSCodeProvider)
  registerProvider(GitHubProvider)
  registerProvider(GeminiProvider)
  registerProvider(CodexProvider)
  registerProvider(ClineProvider)
}

/**
 * Configure which providers are disabled (from user settings).
 */
export function configureDisabledProviders(ids: string[]): void {
  setDisabledProviders(ids)
}

/**
 * Discover MCP server configs from other tools' config directories.
 * Returns a record keyed by server name, suitable for merging into
 * the MCP config pipeline at lowest priority.
 *
 * Each discovered server gets scope: 'dynamic' so it's clearly
 * distinguishable from user-configured servers.
 */
export async function discoverMcpServers(
  cwd: string,
): Promise<Record<string, { command?: string; args?: string[]; env?: Record<string, string>; url?: string; type?: string; scope: 'dynamic' }>> {
  initDiscoveryProviders()
  const items = await loadCapability('mcps', cwd)
  const result: Record<string, { command?: string; args?: string[]; env?: Record<string, string>; url?: string; type?: string; scope: 'dynamic' }> = {}

  for (const item of items) {
    const server = item.content as DiscoveredMCPServer
    if (!server.name) continue
    // Namespace discovered servers to avoid collisions with user configs
    const key = `discovered:${item.source.provider}:${server.name}`
    if (result[key]) continue // first wins (higher priority providers come first)
    result[key] = {
      ...(server.command ? { command: server.command } : {}),
      ...(server.args ? { args: server.args } : {}),
      ...(server.env ? { env: server.env } : {}),
      ...(server.url ? { url: server.url } : {}),
      ...(server.transport === 'sse' ? { type: 'sse' } : {}),
      ...(server.transport === 'streamable-http' ? { type: 'http' } : {}),
      scope: 'dynamic',
    }
  }

  return result
}

/**
 * Discover rules/context from other tools' config directories.
 * Returns an array of { name, content, source } suitable for
 * appending to the memory files list at lowest priority.
 */
export async function discoverRules(
  cwd: string,
): Promise<Array<{ name: string; content: string; source: string; alwaysApply?: boolean }>> {
  initDiscoveryProviders()
  const items = await loadCapability('rules', cwd)
  const result: Array<{ name: string; content: string; source: string; alwaysApply?: boolean }> = []

  for (const item of items) {
    const rule = item.content as DiscoveredRule
    if (!rule.content) continue
    result.push({
      name: rule.name ?? `${item.source.provider}-rule`,
      content: rule.content,
      source: `${item.source.provider}:${item.source.file}`,
      alwaysApply: rule.alwaysApply,
    })
  }

  return result
}
