/**
 * Grep Binding — pure TypeScript grep with LRU cache.
 *
 * Replaces the Rust grep N-API addon. Uses the existing ripgrep subprocess
 * with an LRU cache layer to avoid redundant searches.
 */

import { getCachedGrep, setCachedGrep } from '../utils/grepCache.js'
import { ripGrep } from '../utils/ripgrep.js'

export interface GrepSearchOptions {
  pattern: string
  rootDir: string
  isRegex?: boolean
  caseInsensitive?: boolean
  maxResults?: number
  contextBefore?: number
  contextAfter?: number
  globFilter?: string
  fileType?: string
  respectGitignore?: boolean
}

export interface GrepSearchResult {
  matches: Array<{
    path: string
    lineNumber: number
    lineContent: string
    contextBefore?: string[]
    contextAfter?: string[]
  }>
  filesSearched: number
  truncated: boolean
}

/**
 * Grep search — uses ripgrep subprocess with LRU caching.
 * Always available, no native addon needed.
 */
export async function nativeGrepSearch(options: GrepSearchOptions): Promise<GrepSearchResult> {
  const args: string[] = []

  if (!options.isRegex) args.push('--fixed-strings')
  if (options.caseInsensitive) args.push('-i')
  if (options.contextBefore) args.push('-B', String(options.contextBefore))
  if (options.contextAfter) args.push('-A', String(options.contextAfter))
  if (options.globFilter) args.push('--glob', options.globFilter)
  if (options.fileType) args.push('--type', options.fileType)
  if (options.respectGitignore === false) args.push('--no-ignore')

  const maxResults = options.maxResults ?? 250
  args.push('--max-count', String(maxResults))
  args.push('--json')

  // Check cache
  const cacheKey = [...args, options.pattern]
  const cached = getCachedGrep(options.pattern, options.rootDir, cacheKey)
  if (cached) {
    return JSON.parse(cached)
  }

  // Execute ripgrep with --json for structured output
  try {
    const fullArgs = [...args, options.pattern, options.rootDir]
    const output = await ripGrep(fullArgs, options.rootDir, AbortSignal.timeout(30_000))
    const result = parseJsonOutput(output.join('\n'), maxResults)

    // Cache the result
    setCachedGrep(options.pattern, options.rootDir, cacheKey, JSON.stringify(result))
    return result
  } catch {
    // ripgrep returns exit code 1 for no matches
    return { matches: [], filesSearched: 0, truncated: false }
  }
}

function parseJsonOutput(output: string, maxResults: number): GrepSearchResult {
  const lines = output.split('\n').filter(Boolean)
  const matches: GrepSearchResult['matches'] = []
  let filesSearched = 0

  for (const line of lines) {
    try {
      const msg = JSON.parse(line)
      if (msg.type === 'match') {
        const data = msg.data
        matches.push({
          path: data.path?.text ?? '',
          lineNumber: data.line_number ?? 0,
          lineContent: data.lines?.text?.trimEnd() ?? '',
        })
      } else if (msg.type === 'summary') {
        filesSearched = msg.data?.stats?.searches ?? 0
      }
    } catch {
      // Skip malformed JSON lines
    }
  }

  return {
    matches,
    filesSearched,
    truncated: matches.length >= maxResults,
  }
}

/**
 * Check if grep is available — always true for TS impl.
 */
export function isNativeGrepAvailable(): boolean {
  return true
}
