/**
 * LRU file read cache — tracks what the model last saw for each file.
 * Used by the recovery mechanism to 3-way merge when files change externally.
 */

export interface FileReadSnapshot {
  lines: Map<number, string>
  timestamp: number
}

const MAX_CACHE_SIZE = 30

export class FileReadCache {
  private cache = new Map<string, FileReadSnapshot>()
  private accessOrder: string[] = []

  /**
   * Record the content the model saw when reading a file.
   */
  set(absolutePath: string, fileLines: string[]): void {
    const lines = new Map<number, string>()
    for (let i = 0; i < fileLines.length; i++) {
      lines.set(i + 1, fileLines[i])
    }
    this.cache.set(absolutePath, { lines, timestamp: Date.now() })
    this.touch(absolutePath)
    this.evict()
  }

  /**
   * Get the cached snapshot for a file, or undefined if not cached.
   */
  get(absolutePath: string): FileReadSnapshot | undefined {
    const snapshot = this.cache.get(absolutePath)
    if (snapshot) this.touch(absolutePath)
    return snapshot
  }

  /**
   * Invalidate cache for a file (e.g., after writing).
   */
  invalidate(absolutePath: string): void {
    this.cache.delete(absolutePath)
    this.accessOrder = this.accessOrder.filter(p => p !== absolutePath)
  }

  private touch(path: string): void {
    this.accessOrder = this.accessOrder.filter(p => p !== path)
    this.accessOrder.push(path)
  }

  private evict(): void {
    while (this.cache.size > MAX_CACHE_SIZE && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift()!
      this.cache.delete(oldest)
    }
  }
}

// Singleton instance
let globalCache: FileReadCache | undefined

export function getFileReadCache(): FileReadCache {
  if (!globalCache) globalCache = new FileReadCache()
  return globalCache
}
