/**
 * Hashline edit operation parser.
 * Parses «/»/≔ operations from patch input text.
 */

import { ABORT_MARKER, ABORT_WARNING, BEGIN_PATCH_MARKER, END_PATCH_MARKER, RANGE_INTERIOR_HASH } from './constants'
import {
  HL_FILE_PREFIX,
  HL_HASH_CAPTURE_RE_RAW,
  HL_OP_CHARS,
  HL_OP_INSERT_AFTER,
  HL_OP_INSERT_BEFORE,
  HL_OP_REPLACE,
} from './hash'
import type { Anchor, HashlineCursor, HashlineEdit } from './types'

const LID_CAPTURE_RE = new RegExp(`^${HL_HASH_CAPTURE_RE_RAW}$`)
const regexEscape = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function parseLid(raw: string, lineNum: number): Anchor {
  const match = LID_CAPTURE_RE.exec(raw)
  if (!match) {
    throw new Error(
      `line ${lineNum}: expected a full anchor such as "119ab" or "119zz"; got ${JSON.stringify(raw)}.`,
    )
  }
  return { line: Number.parseInt(match[1], 10), hash: match[2] }
}

interface ParsedRange {
  start: Anchor
  end: Anchor
}

function parseRange(raw: string, lineNum: number): ParsedRange {
  if (!raw.includes('..')) {
    const start = parseLid(raw, lineNum)
    return { start, end: { ...start } }
  }
  const [startRaw, endRaw, extra] = raw.split('..')
  if (extra !== undefined || !startRaw || !endRaw) {
    throw new Error(
      `line ${lineNum}: range must include exactly two full anchors separated by "..".`,
    )
  }
  const start = parseLid(startRaw, lineNum)
  const end = parseLid(endRaw, lineNum)
  if (end.line < start.line) {
    throw new Error(`line ${lineNum}: range ${startRaw}..${endRaw} ends before it starts.`)
  }
  if (end.line === start.line && end.hash !== start.hash) {
    throw new Error(`line ${lineNum}: range ${startRaw}..${endRaw} uses two different hashes for the same line.`)
  }
  return { start, end }
}

function expandRange(range: ParsedRange): Anchor[] {
  const anchors: Anchor[] = []
  for (let line = range.start.line; line <= range.end.line; line++) {
    const hash =
      line === range.start.line ? range.start.hash : line === range.end.line ? range.end.hash : RANGE_INTERIOR_HASH
    anchors.push({ line, hash })
  }
  return anchors
}

export function cloneCursor(cursor: HashlineCursor): HashlineCursor {
  if (cursor.kind === 'bof' || cursor.kind === 'eof') return { ...cursor }
  return { kind: cursor.kind, anchor: { ...cursor.anchor } }
}

function parseInsertTarget(raw: string, lineNum: number, direction: 'before' | 'after'): HashlineCursor {
  const trimmed = raw.trim()
  if (trimmed === 'BOF' || trimmed === 'bof') return { kind: 'bof' }
  if (trimmed === 'EOF' || trimmed === 'eof') return { kind: 'eof' }
  const anchor = parseLid(trimmed, lineNum)
  return direction === 'before'
    ? { kind: 'before_anchor', anchor }
    : { kind: 'after_anchor', anchor }
}

const INSERT_BEFORE_OP_RE = new RegExp(`^${regexEscape(HL_OP_INSERT_BEFORE)}(.+)$`)
const INSERT_AFTER_OP_RE = new RegExp(`^${regexEscape(HL_OP_INSERT_AFTER)}(.+)$`)
const REPLACE_OP_RE = new RegExp(`^${regexEscape(HL_OP_REPLACE)}(.+)$`)

function isPayloadTerminatorLine(line: string): boolean {
  return (
    INSERT_BEFORE_OP_RE.test(line) ||
    INSERT_AFTER_OP_RE.test(line) ||
    REPLACE_OP_RE.test(line) ||
    line.startsWith(HL_FILE_PREFIX) ||
    line.trimEnd() === END_PATCH_MARKER ||
    line.trimEnd() === ABORT_MARKER
  )
}

function collectPayload(
  lines: string[],
  startIdx: number,
  opLineNum: number,
  _isInsert: boolean,
): { payload: string[]; nextIndex: number } {
  const payload: string[] = []
  let i = startIdx
  while (i < lines.length) {
    const line = lines[i]
    if (isPayloadTerminatorLine(line)) break
    payload.push(line)
    i++
  }
  return { payload, nextIndex: i }
}

export interface ParseHashlineResult {
  edits: HashlineEdit[]
  warnings: string[]
}

/**
 * Parse hashline patch text into a list of edit operations.
 */
export function parseHashlineWithWarnings(input: string): ParseHashlineResult {
  const lines = input.split(/\r?\n/)
  const edits: HashlineEdit[] = []
  const warnings: string[] = []
  let editIndex = 0

  const pushInsert = (cursor: HashlineCursor, text: string, lineNum: number) => {
    edits.push({ kind: 'insert', cursor: cloneCursor(cursor), text, lineNum, index: editIndex++ })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const lineNum = i + 1

    // Skip blank lines and envelope markers
    if (line.trim().length === 0 || line.trimEnd() === BEGIN_PATCH_MARKER) {
      i++
      continue
    }
    if (line.trimEnd() === END_PATCH_MARKER) break
    if (line.trimEnd() === ABORT_MARKER) {
      warnings.push(ABORT_WARNING)
      break
    }

    // Skip file headers (handled by input splitter)
    if (line.startsWith(HL_FILE_PREFIX)) {
      i++
      continue
    }

    const insertBeforeMatch = INSERT_BEFORE_OP_RE.exec(line)
    if (insertBeforeMatch) {
      const cursor = parseInsertTarget(insertBeforeMatch[1], lineNum, 'before')
      const { payload, nextIndex } = collectPayload(lines, i + 1, lineNum, true)
      for (const text of payload) pushInsert(cursor, text, lineNum)
      i = nextIndex
      continue
    }

    const insertAfterMatch = INSERT_AFTER_OP_RE.exec(line)
    if (insertAfterMatch) {
      const cursor = parseInsertTarget(insertAfterMatch[1], lineNum, 'after')
      const { payload, nextIndex } = collectPayload(lines, i + 1, lineNum, true)
      for (const text of payload) pushInsert(cursor, text, lineNum)
      i = nextIndex
      continue
    }

    const replaceMatch = REPLACE_OP_RE.exec(line)
    if (replaceMatch) {
      const range = parseRange(replaceMatch[1], lineNum)
      const { payload, nextIndex } = collectPayload(lines, i + 1, lineNum, false)
      if (payload.length > 0) {
        for (const text of payload) {
          edits.push({
            kind: 'insert',
            cursor: { kind: 'before_anchor', anchor: { ...range.start } },
            text,
            lineNum,
            index: editIndex++,
          })
        }
      }
      for (const anchor of expandRange(range)) {
        edits.push({ kind: 'delete', anchor, lineNum, index: editIndex++ })
      }
      i = nextIndex
      continue
    }

    if (isPayloadTerminatorLine(line) || /^[-@\u00B6]/u.test(line)) {
      throw new Error(
        `line ${lineNum}: unrecognized op. Use ${HL_OP_INSERT_BEFORE}ANCHOR (insert before), ` +
        `${HL_OP_INSERT_AFTER}ANCHOR (insert after), or ${HL_OP_REPLACE}A..B (replace/delete). ` +
        `Got ${JSON.stringify(line)}.`,
      )
    }

    throw new Error(
      `line ${lineNum}: payload line has no preceding ${HL_OP_INSERT_BEFORE}, ` +
      `${HL_OP_INSERT_AFTER}, or ${HL_OP_REPLACE} operation. Got ${JSON.stringify(line)}.`,
    )
  }

  return { edits, warnings }
}
