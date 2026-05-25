/**
 * Hashline edit application logic.
 * Applies parsed edits to file content, validating anchors and applying bottom-up.
 */

import { HashlineMismatchError } from './anchors'
import { RANGE_INTERIOR_HASH } from './constants'
import { computeLineHash } from './hash'
import { cloneCursor } from './parser'
import type { Anchor, HashlineApplyOptions, HashlineCursor, HashlineEdit, HashlineApplyResult, HashMismatch } from './types'

interface IndexedEdit {
  edit: HashlineEdit
  idx: number
}

function getHashlineEditAnchors(edit: HashlineEdit): Anchor[] {
  if (edit.kind === 'delete') return [edit.anchor]
  if (edit.cursor.kind === 'before_anchor') return [edit.cursor.anchor]
  if (edit.cursor.kind === 'after_anchor') return [edit.cursor.anchor]
  return []
}

/**
 * Verify every anchor's hash. Any mismatch is reported as a HashMismatch.
 */
function validateHashlineAnchors(edits: HashlineEdit[], fileLines: string[]): HashMismatch[] {
  const mismatches: HashMismatch[] = []
  for (const edit of edits) {
    for (const anchor of getHashlineEditAnchors(edit)) {
      if (anchor.line < 1 || anchor.line > fileLines.length) {
        throw new Error(`Line ${anchor.line} does not exist (file has ${fileLines.length} lines)`)
      }
      if (anchor.hash === RANGE_INTERIOR_HASH) continue
      const actualHash = computeLineHash(anchor.line, fileLines[anchor.line - 1] ?? '')
      if (actualHash === anchor.hash) continue
      mismatches.push({ line: anchor.line, expected: anchor.hash, actual: actualHash })
    }
  }
  return mismatches
}

function bucketAnchorEditsByLine(edits: IndexedEdit[]): Map<number, IndexedEdit[]> {
  const byLine = new Map<number, IndexedEdit[]>()
  for (const ie of edits) {
    const { edit } = ie
    let line: number
    if (edit.kind === 'delete') {
      line = edit.anchor.line
    } else if (edit.cursor.kind === 'before_anchor') {
      line = edit.cursor.anchor.line
    } else if (edit.cursor.kind === 'after_anchor') {
      line = edit.cursor.anchor.line
    } else {
      continue
    }
    const bucket = byLine.get(line)
    if (bucket) bucket.push(ie)
    else byLine.set(line, [ie])
  }
  return byLine
}

/**
 * Deduplicate pure-insert edits that would create duplicate lines.
 */
function deduplicateInserts(edits: HashlineEdit[], fileLines: string[], options: HashlineApplyOptions): HashlineEdit[] {
  if (!options.autoDropPureInsertDuplicates) return edits
  const fileLineSet = new Set(fileLines.map(l => l.trimEnd()))
  return edits.filter(edit => {
    if (edit.kind !== 'insert') return true
    if (edit.cursor.kind !== 'bof' && edit.cursor.kind !== 'eof' &&
        edit.cursor.kind !== 'before_anchor' && edit.cursor.kind !== 'after_anchor') return true
    // Only drop if the exact text already exists in the file
    return !fileLineSet.has(edit.text.trimEnd())
  })
}

/**
 * Apply hashline edits to file content.
 * Edits are applied bottom-up so earlier indices stay valid.
 */
export function applyHashlineEdits(
  fileText: string,
  edits: HashlineEdit[],
  options: HashlineApplyOptions = {},
): HashlineApplyResult {
  const fileLines = fileText.split('\n')
  const warnings: string[] = []

  // Validate all anchors first
  const mismatches = validateHashlineAnchors(edits, fileLines)
  if (mismatches.length > 0) {
    throw new HashlineMismatchError(mismatches, fileLines)
  }

  // Deduplicate if configured
  const normalizedEdits = deduplicateInserts(edits, fileLines, options)

  if (normalizedEdits.length === 0) {
    return { lines: fileText }
  }

  let firstChangedLine: number | undefined

  const trackFirstChanged = (line: number) => {
    if (firstChangedLine === undefined || line < firstChangedLine) {
      firstChangedLine = line
    }
  }

  // Partition edits into BOF, EOF, and anchor-targeted buckets
  const bofLines: string[] = []
  const eofLines: string[] = []
  const anchorEdits: IndexedEdit[] = []
  normalizedEdits.forEach((edit, idx) => {
    if (edit.kind === 'insert' && edit.cursor.kind === 'bof') {
      bofLines.push(edit.text)
    } else if (edit.kind === 'insert' && edit.cursor.kind === 'eof') {
      eofLines.push(edit.text)
    } else {
      anchorEdits.push({ edit, idx })
    }
  })

  // Apply per-line buckets bottom-up so earlier indices stay valid
  const byLine = bucketAnchorEditsByLine(anchorEdits)
  for (const line of [...byLine.keys()].sort((a, b) => b - a)) {
    const bucket = byLine.get(line)
    if (!bucket) continue
    bucket.sort((a, b) => a.idx - b.idx)

    const idx = line - 1
    const beforeLines: string[] = []
    let deleteLine = false

    for (const { edit } of bucket) {
      if (edit.kind === 'insert') {
        beforeLines.push(edit.text)
      } else if (edit.kind === 'delete') {
        deleteLine = true
      }
    }
    if (beforeLines.length === 0 && !deleteLine) continue

    const replacement = deleteLine ? beforeLines : [...beforeLines, fileLines[idx]]
    fileLines.splice(idx, 1, ...replacement)
    trackFirstChanged(line)
  }

  if (bofLines.length > 0) {
    fileLines.splice(0, 0, ...bofLines)
    trackFirstChanged(1)
  }
  if (eofLines.length > 0) {
    fileLines.push(...eofLines)
    trackFirstChanged(fileLines.length - eofLines.length + 1)
  }

  return {
    lines: fileLines.join('\n'),
    firstChangedLine,
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}
