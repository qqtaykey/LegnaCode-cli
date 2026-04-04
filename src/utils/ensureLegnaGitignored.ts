/**
 * Auto-add .legna/ to project .gitignore on first use.
 * Best-effort — errors are silently ignored.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import memoize from 'lodash-es/memoize.js'
import { join } from 'path'

const ENTRY = '.legna/'

function _ensure(projectRoot: string): void {
  try {
    const gitignore = join(projectRoot, '.gitignore')
    if (existsSync(gitignore)) {
      const content = readFileSync(gitignore, 'utf-8')
      if (content.includes(ENTRY) || content.includes('.legna')) return
      appendFileSync(gitignore, `\n${ENTRY}\n`)
    } else {
      writeFileSync(gitignore, `${ENTRY}\n`)
    }
  } catch {
    // best-effort
  }
}

/**
 * Memoized per projectRoot — each project only gets one .gitignore check.
 */
export const ensureLegnaGitignored = memoize(_ensure)
