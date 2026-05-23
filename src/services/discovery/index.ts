/**
 * Configuration Discovery — live federation layer for multi-tool config inheritance.
 *
 * Reads configurations from other AI coding tools' directories in real time,
 * without copying or migrating. Each tool is a "provider" that registers itself.
 * When a capability is requested, all providers are queried and results merged by priority.
 */

export interface DiscoveryProvider {
  id: string
  displayName: string
  priority: number
  /** Load a specific capability from this provider's config directories */
  load(capability: CapabilityType, cwd: string): Promise<DiscoveredItem[]>
}

export type CapabilityType = 'mcps' | 'rules' | 'context' | 'settings'

export interface DiscoveredItem {
  type: CapabilityType
  content: any
  source: SourceMeta
}

export interface SourceMeta {
  provider: string
  file: string
  priority: number
}

export interface DiscoveredMCPServer {
  name: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  transport?: 'stdio' | 'sse' | 'streamable-http'
}

export interface DiscoveredRule {
  name: string
  content: string
  alwaysApply?: boolean
  globs?: string[]
  description?: string
}

// Provider registry
const _providers: DiscoveryProvider[] = []
let _disabledProviders: Set<string> = new Set()

/**
 * Register a discovery provider.
 */
export function registerProvider(provider: DiscoveryProvider): void {
  _providers.push(provider)
  _providers.sort((a, b) => b.priority - a.priority) // Higher priority first
}

/**
 * Disable specific providers (user preference).
 */
export function setDisabledProviders(ids: string[]): void {
  _disabledProviders = new Set(ids)
}

/**
 * Load a capability from all enabled providers, merged by priority.
 */
export async function loadCapability(
  capability: CapabilityType,
  cwd: string,
): Promise<DiscoveredItem[]> {
  const results: DiscoveredItem[] = []

  for (const provider of _providers) {
    if (_disabledProviders.has(provider.id)) continue
    try {
      const items = await provider.load(capability, cwd)
      results.push(...items)
    } catch {
      // Silently skip failing providers
    }
  }

  return deduplicateByKey(results, capability)
}

/**
 * Get all registered provider IDs.
 */
export function getRegisteredProviders(): string[] {
  return _providers.map(p => p.id)
}

// Deduplicate items by a capability-specific key
function deduplicateByKey(items: DiscoveredItem[], capability: CapabilityType): DiscoveredItem[] {
  if (capability === 'mcps') {
    // Deduplicate MCP servers by name (higher priority wins)
    const seen = new Map<string, DiscoveredItem>()
    for (const item of items) {
      const name = (item.content as DiscoveredMCPServer).name
      if (!seen.has(name)) seen.set(name, item)
    }
    return [...seen.values()]
  }
  // Rules and context: keep all, ordered by priority
  return items
}
