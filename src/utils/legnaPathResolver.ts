/**
 * Unified path resolver for LegnaCode project-local and global data.
 *
 * All project-level data lives under <project>/.legna/. Reads fall back
 * to the legacy .claude/ directory for backward compatibility.
 */

import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export const PROJECT_FOLDER = '.legna'
export const LEGACY_FOLDER = '.claude'

/**
 * Project-local data root: <cwd>/.legna/
 */
export function getProjectLocalDir(cwd: string): string {
  return join(cwd, PROJECT_FOLDER)
}

/**
 * Resolve a project-level subpath with fallback.
 * Checks .legna/ first, then .claude/ for backward compat.
 * Returns undefined if neither exists.
 */
export function resolveProjectPath(
  subpath: string,
  cwd: string,
): string | undefined {
  const legna = join(cwd, PROJECT_FOLDER, subpath)
  if (existsSync(legna)) return legna
  const claude = join(cwd, LEGACY_FOLDER, subpath)
  if (existsSync(claude)) return claude
  return undefined
}

/**
 * Resolve a project-level subpath, returning the .legna/ path as default
 * when neither location exists (for write operations).
 */
export function resolveProjectPathOrDefault(
  subpath: string,
  cwd: string,
): string {
  return resolveProjectPath(subpath, cwd) ?? join(cwd, PROJECT_FOLDER, subpath)
}

/**
 * Ensure a subdirectory exists under <cwd>/.legna/ and return its path.
 */
export function ensureProjectLocalDir(cwd: string, subdir: string): string {
  const dir = join(cwd, PROJECT_FOLDER, subdir)
  mkdirSync(dir, { recursive: true })
  return dir
}
