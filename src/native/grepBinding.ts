/**
 * Native Grep TypeScript binding — wraps Rust grep addon with ripgrep fallback.
 *
 * Uses grep-regex/grep-searcher/ignore crates (ripgrep's core libraries)
 * when native addon is available. Falls back to spawning `rg` binary otherwise.
 */

import {
  grepAddon,
  hasNativeGrep,
  type NativeGrepOptions,
  type NativeGrepMatch,
  type NativeGrepResult,
} from './index.js'

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
 * Native grep search — uses Rust ripgrep libraries in-process.
 * Returns null if native addon is unavailable (caller should fallback to rg binary).
 */
export function nativeGrepSearch(options: GrepSearchOptions): GrepSearchResult | null {
  if (!hasNativeGrep || !grepAddon) {
    return null // Caller should fallback to ripgrep binary
  }

  const nativeOpts: NativeGrepOptions = {
    pattern: options.pattern,
    root_dir: options.rootDir,
    is_regex: options.isRegex ?? true,
    case_insensitive: options.caseInsensitive ?? false,
    max_results: options.maxResults ?? 250,
    context_before: options.contextBefore ?? 0,
    context_after: options.contextAfter ?? 0,
    glob_filter: options.globFilter,
    file_type: options.fileType,
    respect_gitignore: options.respectGitignore ?? true,
  }

  const result: NativeGrepResult = grepAddon.grepSearch(nativeOpts)

  return {
    matches: result.matches.map((m: NativeGrepMatch) => ({
      path: m.path,
      lineNumber: m.line_number,
      lineContent: m.line_content,
      contextBefore: m.context_before,
      contextAfter: m.context_after,
    })),
    filesSearched: result.files_searched,
    truncated: result.truncated,
  }
}

/**
 * Check if native grep is available.
 */
export function isNativeGrepAvailable(): boolean {
  return hasNativeGrep
}
