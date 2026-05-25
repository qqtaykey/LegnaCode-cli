/**
 * Hashline edit execution orchestrator.
 * Coordinates parsing, validation, application, and recovery for hashline edits.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { HashlineMismatchError } from './anchors'
import { applyHashlineEdits } from './apply'
import { getFileReadCache } from './fileReadCache'
import { splitHashlineInputs, type HashlineInputSection } from './input'
import { parseHashlineWithWarnings } from './parser'
import { tryRecoverHashlineWithCache } from './recovery'
import type { HashlineApplyOptions, HashlineEdit } from './types'

export interface HashlineExecuteResult {
  success: boolean
  message: string
  diff?: string
  warnings?: string[]
  sectionsApplied?: number
}

interface SectionResult {
  path: string
  success: boolean
  message: string
  diff?: string
  warnings?: string[]
}

async function readFileText(absolutePath: string): Promise<{ exists: boolean; content: string }> {
  try {
    const content = await fs.promises.readFile(absolutePath, 'utf-8')
    return { exists: true, content }
  } catch (err: any) {
    if (err.code === 'ENOENT') return { exists: false, content: '' }
    throw err
  }
}

function generateSimpleDiff(original: string, modified: string, filePath: string): string {
  const origLines = original.split('\n')
  const modLines = modified.split('\n')
  const diffLines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`]

  let i = 0, j = 0
  while (i < origLines.length || j < modLines.length) {
    if (i < origLines.length && j < modLines.length && origLines[i] === modLines[j]) {
      i++; j++
      continue
    }
    // Find a changed region
    const contextStart = Math.max(0, i - 1)
    let origEnd = i, modEnd = j
    // Scan forward to find where they re-sync
    while (origEnd < origLines.length && modEnd < modLines.length && origLines[origEnd] !== modLines[modEnd]) {
      origEnd++; modEnd++
    }
    if (origEnd === i && modEnd === j) {
      // One side has extra lines
      if (i >= origLines.length) {
        diffLines.push(`@@ +${j + 1} @@`)
        while (j < modLines.length) { diffLines.push(`+${modLines[j]}`); j++ }
      } else {
        diffLines.push(`@@ -${i + 1} @@`)
        while (i < origLines.length) { diffLines.push(`-${origLines[i]}`); i++ }
      }
      continue
    }
    diffLines.push(`@@ -${i + 1},${origEnd - i} +${j + 1},${modEnd - j} @@`)
    for (let k = i; k < origEnd; k++) diffLines.push(`-${origLines[k]}`)
    for (let k = j; k < modEnd; k++) diffLines.push(`+${modLines[k]}`)
    i = origEnd; j = modEnd
  }

  return diffLines.join('\n')
}

async function executeSection(
  section: HashlineInputSection,
  cwd: string,
  options: HashlineApplyOptions,
): Promise<SectionResult> {
  const absolutePath = path.isAbsolute(section.path)
    ? section.path
    : path.resolve(cwd, section.path)

  const { exists, content: rawContent } = await readFileText(absolutePath)

  // For new files, only BOF/EOF inserts make sense
  const currentText = rawContent.replace(/\r\n/g, '\n')

  // Parse the diff into edit operations
  const { edits, warnings } = parseHashlineWithWarnings(section.diff)

  if (edits.length === 0) {
    return { path: section.path, success: true, message: 'No edits to apply.', warnings }
  }

  // Try to apply edits
  let resultText: string
  let firstChangedLine: number | undefined
  const allWarnings = [...warnings]

  try {
    const result = applyHashlineEdits(currentText, edits, options)
    resultText = result.lines
    firstChangedLine = result.firstChangedLine
    if (result.warnings) allWarnings.push(...result.warnings)
  } catch (err) {
    if (err instanceof HashlineMismatchError) {
      // Try recovery via cached snapshot
      const cache = getFileReadCache()
      const recovered = tryRecoverHashlineWithCache({
        cache,
        absolutePath,
        currentText,
        edits,
        options,
      })
      if (recovered) {
        resultText = recovered.lines
        firstChangedLine = recovered.firstChangedLine
        allWarnings.push(...recovered.warnings)
      } else {
        return {
          path: section.path,
          success: false,
          message: err.displayMessage || err.message,
        }
      }
    } else {
      throw err
    }
  }

  // Check if anything actually changed
  if (resultText === currentText) {
    return {
      path: section.path,
      success: true,
      message: `Edits to ${section.path} resulted in no changes.`,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    }
  }

  // Write the file
  const dir = path.dirname(absolutePath)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(absolutePath, resultText, 'utf-8')

  // Invalidate cache for this file
  getFileReadCache().invalidate(absolutePath)

  const diff = generateSimpleDiff(currentText, resultText, section.path)

  return {
    path: section.path,
    success: true,
    message: `Applied edits to ${section.path}`,
    diff,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  }
}

/**
 * Execute a hashline edit operation.
 * Handles multi-file patches (multiple §PATH sections).
 */
export async function executeHashlineEdit(
  input: string,
  cwd: string,
  defaultPath?: string,
): Promise<HashlineExecuteResult> {
  // Split input into per-file sections
  let sections: HashlineInputSection[]
  try {
    sections = splitHashlineInputs(input, { cwd, path: defaultPath })
  } catch (err: any) {
    return { success: false, message: err.message }
  }

  if (sections.length === 0) {
    return { success: false, message: 'No edit sections found in input.' }
  }

  // Merge sections targeting the same path
  const merged = mergeSamePathSections(sections)

  const results: SectionResult[] = []
  for (const section of merged) {
    try {
      results.push(await executeSection(section, cwd, {}))
    } catch (err: any) {
      results.push({ path: section.path, success: false, message: err.message })
    }
  }

  const allSuccess = results.every(r => r.success)
  const messages = results.map(r => r.message)
  const diffs = results.filter(r => r.diff).map(r => r.diff!)
  const allWarnings = results.flatMap(r => r.warnings ?? [])

  return {
    success: allSuccess,
    message: messages.join('\n\n'),
    diff: diffs.length > 0 ? diffs.join('\n') : undefined,
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
    sectionsApplied: results.filter(r => r.success).length,
  }
}

function mergeSamePathSections(sections: HashlineInputSection[]): HashlineInputSection[] {
  const byPath = new Map<string, string[]>()
  for (const section of sections) {
    const existing = byPath.get(section.path)
    if (existing) existing.push(section.diff)
    else byPath.set(section.path, [section.diff])
  }
  return Array.from(byPath, ([p, diffs]) => ({ path: p, diff: diffs.join('\n') }))
}
