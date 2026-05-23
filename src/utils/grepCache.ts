/**
 * Grep Cache — LRU cache for ripgrep results.
 *
 * Same path + same pattern within TTL → return cached result.
 * Avoids redundant rg subprocess spawns when the model re-searches.
 */

const CACHE_TTL_MS = 5_000 // 5 seconds
const MAX_ENTRIES = 50

interface CacheEntry {
  key: string
  result: string
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function makeKey(pattern: string, path: string, args: string[]): string {
  return `${pattern}\0${path}\0${args.join('\0')}`
}

function evictStale(): void {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(key)
    }
  }
  // LRU eviction if over capacity
  if (cache.size > MAX_ENTRIES) {
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = entries.slice(0, cache.size - MAX_ENTRIES)
    for (const [key] of toRemove) {
      cache.delete(key)
    }
  }
}

/**
 * Get cached grep result if available and fresh.
 */
export function getCachedGrep(pattern: string, path: string, args: string[]): string | null {
  evictStale()
  const key = makeKey(pattern, path, args)
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key)
    return null
  }
  return entry.result
}

/**
 * Store grep result in cache.
 */
export function setCachedGrep(pattern: string, path: string, args: string[], result: string): void {
  const key = makeKey(pattern, path, args)
  cache.set(key, { key, result, timestamp: Date.now() })
  evictStale()
}

/**
 * Invalidate all cached results for a given path (e.g., after file edit).
 */
export function invalidateGrepCache(path?: string): void {
  if (!path) {
    cache.clear()
    return
  }
  for (const [key] of cache) {
    if (key.includes(path)) {
      cache.delete(key)
    }
  }
}

/**
 * Get cache stats for debugging.
 */
export function getGrepCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return { size: cache.size, maxSize: MAX_ENTRIES, ttlMs: CACHE_TTL_MS }
}
