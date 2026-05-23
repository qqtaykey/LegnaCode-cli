/**
 * Core hash utilities for the hashline edit system.
 *
 * Each line gets a 2-character hash anchor computed via xxHash32 mod 647,
 * indexing into a table of single-BPE-token bigrams. The model references
 * these anchors to locate edit positions precisely.
 */

import bigrams from './bigrams.json'

/**
 * 647 single-token BPE bigrams. Every entry tokenizes as exactly one token
 * in modern BPE vocabularies (cl100k / o200k / Claude family).
 * Order is stable forever — changing it invalidates all saved anchors.
 */
export const HL_BIGRAMS: readonly string[] = bigrams
export const HL_BIGRAMS_COUNT = HL_BIGRAMS.length

/** File path header prefix character. */
export const HL_FILE_PREFIX = '§'

/** Insert-before operator. */
export const HL_OP_INSERT_BEFORE = '«'

/** Insert-after operator. */
export const HL_OP_INSERT_AFTER = '»'

/** Replace/delete operator. */
export const HL_OP_REPLACE = '≔'

/** All operator characters combined for regex use. */
export const HL_OP_CHARS = `${HL_OP_INSERT_BEFORE}${HL_OP_INSERT_AFTER}${HL_OP_REPLACE}`

/** Body separator between anchor and line content. */
export const HL_BODY_SEP = '|'

/** Regex-escaped body separator. */
const regexEscape = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const HL_BODY_SEP_RE_RAW = regexEscape(HL_BODY_SEP)

/**
 * Capture-group regex source for LINE+HASH anchor.
 * Group 1: line number (digits), Group 2: hash (2 lowercase letters).
 */
export const HL_HASH_CAPTURE_RE_RAW = `([1-9]\\d*)([a-z]{2})`

/** Bare LINE+HASH pattern (no captures). */
export const HL_HASH_RE_RAW = `[1-9]\\d*[a-z]{2}`

/** Anchor decoration prefix regex (context markers like >, +, -, *). */
export const HL_ANCHOR_DECORATION_RE_RAW = `\\s*[>+\\-*]*\\s*`

/** Full anchor regex with decorations. Group 1: line number, Group 2: hash. */
export const HL_ANCHOR_RE_RAW = `${HL_ANCHOR_DECORATION_RE_RAW}(\\d+)([a-z]{2})`

/** Width of a hash in display characters. */
export const HL_HASH_WIDTH = 2

/**
 * Describe example anchors for error messages.
 */
export function describeAnchorExamples(lineNum: string): string {
  return `"${lineNum}ab" or "${lineNum}zz"`
}

/**
 * Compute a 2-character hash of a single line via xxHash32 mod 647.
 * The hash depends only on the line's content (after stripping CR and trailing whitespace).
 * The `idx` parameter is intentionally unused so anchors remain stable across line shifts.
 */
export function computeLineHash(idx: number, line: string): string {
  void idx
  line = line.replace(/\r/g, '').trimEnd()
  return HL_BIGRAMS[Bun.hash.xxHash32(line, 0) % HL_BIGRAMS_COUNT]
}

/**
 * Formats an anchor reference: LINE+HASH (e.g., `42sr`).
 */
export function formatLineHash(line: number, text: string): string {
  return `${line}${computeLineHash(line, text)}`
}

/**
 * Formats a single line with hashline anchor: LINE+HASH|TEXT
 */
export function formatHashLine(lineNumber: number, line: string): string {
  return `${lineNumber}${computeLineHash(lineNumber, line)}${HL_BODY_SEP}${line}`
}

/**
 * Format file text with hashline prefixes for display.
 * Each line becomes `LINE+ID|TEXT` where LINENUM is 1-indexed.
 */
export function formatHashLines(text: string, startLine = 1): string {
  const lines = text.split('\n')
  return lines.map((line, i) => formatHashLine(startLine + i, line)).join('\n')
}
