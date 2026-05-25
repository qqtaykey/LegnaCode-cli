/**
 * Type definitions for the hashline edit system.
 */

import { z } from 'zod/v4'

export interface HashMismatch {
  line: number
  expected: string
  actual: string
}

export type Anchor = {
  line: number
  hash: string
  contentHint?: string
}

export type HashlineCursor =
  | { kind: 'bof' }
  | { kind: 'eof' }
  | { kind: 'before_anchor'; anchor: Anchor }
  | { kind: 'after_anchor'; anchor: Anchor }

export type HashlineEdit =
  | { kind: 'insert'; cursor: HashlineCursor; text: string; lineNum: number; index: number }
  | { kind: 'delete'; anchor: Anchor; lineNum: number; index: number; oldAssertion?: string }

export const hashlineEditParamsSchema = z.object({
  input: z.string().describe('The hashline patch input containing §PATH headers and edit operations'),
  path: z.string().optional().describe('Default file path if input has no §PATH header'),
})

export type HashlineParams = z.infer<typeof hashlineEditParamsSchema>

export interface HashlineApplyOptions {
  autoDropPureInsertDuplicates?: boolean
}

export interface SplitHashlineOptions {
  cwd?: string
  path?: string
}

export interface HashlineApplyResult {
  lines: string
  firstChangedLine?: number
  warnings?: string[]
}

export interface CompactHashlineDiffPreview {
  preview: string
  addedLines: number
  removedLines: number
}
