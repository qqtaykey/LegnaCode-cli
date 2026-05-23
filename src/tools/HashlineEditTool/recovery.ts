/**
 * Recovery mechanism — 3-way merge when file changed externally between read and edit.
 * If the model's anchors match a cached snapshot but not the current file,
 * we apply edits to the snapshot and 3-way merge onto the current content.
 */

import { HashlineMismatchError } from './anchors'
import { applyHashlineEdits } from './apply'
import { computeLineHash } from './hash'
import type { FileReadCache } from './fileReadCache'
import type { Anchor, HashlineApplyOptions, HashlineApplyResult, HashlineEdit } from './types'

export interface HashlineRecoveryArgs {
  cache: FileReadCache
  absolutePath: string
  currentText: string
  edits: HashlineEdit[]
  options: HashlineApplyOptions
}

export interface HashlineRecoveryResult {
  lines: string
  firstChangedLine: number | undefined
  warnings: string[]
}

const HASHLINE_RECOVERY_WARNING =
  'Recovered from stale anchors using a previous read snapshot (file changed externally between read and edit).'

/** Collect every line anchor an edit batch depends on. */
function collectEditAnchors(edits: HashlineEdit[]): Anchor[] {
  const anchors: Anchor[] = []
  for (const edit of edits) {
    if (edit.kind === 'delete') {
      anchors.push(edit.anchor)
      continue
    }
    const cursor = edit.cursor
    if (cursor.kind === 'before_anchor' || cursor.kind === 'after_anchor') {
      anchors.push(cursor.anchor)
    }
  }
  return anchors
}

/**
 * Attempt to recover from a HashlineMismatchError by replaying edits
 * against a cached pre-edit snapshot and 3-way-merging onto current content.
 * Returns null when no recovery is possible.
 */
/**
 * Attempt to recover from a HashlineMismatchError by replaying edits
 * against a cached pre-edit snapshot and 3-way-merging onto current content.
 * Returns null when no recovery is possible.
 */
export function tryRecoverHashlineWithCache(args: HashlineRecoveryArgs): HashlineRecoveryResult | null {
  const { cache, absolutePath, currentText, edits, options } = args

  const snapshot = cache.get(absolutePath)
  if (!snapshot || snapshot.lines.size === 0) return null

  // Precondition: the model's anchors must be vouched-for by the cache
  const anchors = collectEditAnchors(edits)
  for (const anchor of anchors) {
    const cachedLine = snapshot.lines.get(anchor.line)
    if (cachedLine === undefined) return null
    if (computeLineHash(anchor.line, cachedLine) !== anchor.hash) return null
  }

  // Reconstruct the file as the model saw it
  const overlaid = currentText.split('\n')
  let maxCachedLine = 0
  for (const lineNum of snapshot.lines.keys()) {
    if (lineNum > maxCachedLine) maxCachedLine = lineNum
  }
  while (overlaid.length < maxCachedLine) overlaid.push('')
  for (const [lineNum, content] of snapshot.lines) {
    overlaid[lineNum - 1] = content
  }
  const previousText = overlaid.join('\n')
  if (previousText === currentText) return null

  // Apply edits to the snapshot
  let applied: HashlineApplyResult
  try {
    applied = applyHashlineEdits(previousText, edits, options)
  } catch (err) {
    if (err instanceof HashlineMismatchError) return null
    throw err
  }
  if (applied.lines === previousText) return null

  // Simple line-by-line merge: apply changes from snapshot→applied onto current
  const currentLines = currentText.split('\n')
  const previousLines = previousText.split('\n')
  const appliedLines = applied.lines.split('\n')

  // If lengths differ significantly, fall back to simple replacement
  // (a full 3-way merge with diff library would be ideal but adds dependency)
  if (previousLines.length !== currentLines.length) {
    // Can't safely merge when line counts differ without a proper diff library
    return null
  }

  // Line-by-line merge: where previous→applied changed, apply that change to current
  const mergedLines = [...currentLines]
  let hasChange = false
  for (let i = 0; i < Math.min(previousLines.length, appliedLines.length); i++) {
    if (previousLines[i] !== appliedLines[i]) {
      mergedLines[i] = appliedLines[i]
      hasChange = true
    }
  }
  // Handle added lines at end
  if (appliedLines.length > previousLines.length) {
    for (let i = previousLines.length; i < appliedLines.length; i++) {
      mergedLines.push(appliedLines[i])
      hasChange = true
    }
  }

  if (!hasChange) return null

  const merged = mergedLines.join('\n')
  if (merged === currentText) return null

  return {
    lines: merged,
    firstChangedLine: applied.firstChangedLine,
    warnings: [HASHLINE_RECOVERY_WARNING, ...(applied.warnings ?? [])],
  }
}
