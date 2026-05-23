/**
 * Native Grep TypeScript binding — wraps Rust grep addon.
 *
 * Uses grep-regex/grep-searcher/ignore crates (ripgrep's core libraries)
 * for in-process parallel file search. No fallback — if the native addon
 * is not compiled, this module throws at call time.
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
 * Throws if native addon is not available.
 */
export function nativeGrepSearch(options: GrepSearchOptions): GrepSearchResult {
  if (!hasNativeGrep || !grepAddon) {
    throw new Error(
      'Native grep addon not available. Run `cd native && cargo build --release` to compile, ' +
      'or disable NATIVE_GREP feature flag in bunfig.toml.'
    )
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
