/**
 * Output Minimizer — compresses verbose CLI output into concise summaries.
 *
 * Pattern-based rules for common tools (git, npm, cargo, gradle, pip, etc.)
 * that produce hundreds of lines of output where only a few lines matter.
 */

export interface MinimizeResult {
  minimized: string
  originalLines: number
  minimizedLines: number
  tool: string | null
}

interface MinimizeRule {
  tool: string
  /** Detect if this rule applies to the command */
  match: (command: string) => boolean
  /** Transform the output */
  minimize: (stdout: string, stderr: string) => string | null
}

const rules: MinimizeRule[] = [
  {
    tool: 'npm install',
    match: (cmd) => /\bnpm\s+(install|i|ci)\b/.test(cmd),
    minimize: (stdout, stderr) => {
      const combined = stdout + stderr
      // Look for "added X packages in Ys"
      const added = combined.match(/added (\d+) packages? in ([\d.]+m?s)/i)
      if (added) return `installed ${added[1]} packages in ${added[2]}`
      // Look for "up to date"
      if (/up to date/i.test(combined)) return 'up to date, no changes'
      // Look for audit summary
      const audit = combined.match(/(\d+) vulnerabilit/i)
      const summary = added ? `installed ${added[1]} packages` : 'install complete'
      return audit ? `${summary} (${audit[0]})` : null
    },
  },
  {
    tool: 'npm run',
    match: (cmd) => /\bnpm\s+run\b/.test(cmd),
    minimize: (_stdout, stderr) => {
      // npm run outputs lifecycle scripts to stderr — skip those
      const lines = stderr.split('\n').filter(l => !l.startsWith('>') && l.trim())
      if (lines.length === 0) return null
      return null // Don't minimize actual script output
    },
  },
  {
    tool: 'git clone',
    match: (cmd) => /\bgit\s+clone\b/.test(cmd),
    minimize: (_stdout, stderr) => {
      const lines = stderr.split('\n')
      const done = lines.find(l => /done\.$/.test(l) || /Resolving deltas.*done/.test(l))
      if (done) return `clone complete`
      return null
    },
  },
  {
    tool: 'git fetch',
    match: (cmd) => /\bgit\s+fetch\b/.test(cmd),
    minimize: (_stdout, stderr) => {
      if (!stderr.trim() || /Already up to date/i.test(stderr)) return 'already up to date'
      const lines = stderr.split('\n').filter(l => l.trim())
      if (lines.length > 10) {
        const branches = lines.filter(l => /->/.test(l))
        return `fetched ${branches.length} refs`
      }
      return null
    },
  },
  {
    tool: 'pip install',
    match: (cmd) => /\bpip3?\s+install\b/.test(cmd),
    minimize: (stdout) => {
      const already = (stdout.match(/already satisfied/gi) || []).length
      const installed = stdout.match(/Successfully installed (.+)/i)
      if (installed) {
        const pkgs = installed[1].split(/\s+/).length
        const msg = `installed ${pkgs} packages`
        return already ? `${msg} (${already} already satisfied)` : msg
      }
      if (already) return `${already} packages already satisfied`
      return null
    },
  },
  {
    tool: 'cargo build',
    match: (cmd) => /\bcargo\s+(build|check)\b/.test(cmd),
    minimize: (_stdout, stderr) => {
      const compiling = (stderr.match(/Compiling/g) || []).length
      const finished = stderr.match(/Finished.*in ([\d.]+s)/i)
      if (finished) {
        return compiling
          ? `compiled ${compiling} crates in ${finished[1]}`
          : `build finished in ${finished[1]}`
      }
      return null
    },
  },
  {
    tool: 'bun install',
    match: (cmd) => /\bbun\s+(install|i|add)\b/.test(cmd),
    minimize: (stdout) => {
      const done = stdout.match(/(\d+) packages? installed/i)
      if (done) return `installed ${done[1]} packages`
      if (/nothing to install/i.test(stdout)) return 'nothing to install'
      return null
    },
  },
  {
    tool: 'docker build',
    match: (cmd) => /\bdocker\s+(build|buildx)\b/.test(cmd),
    minimize: (stdout) => {
      const lines = stdout.split('\n')
      if (lines.length < 20) return null
      const steps = lines.filter(l => /^(Step|#)\s*\d+/.test(l)).length
      const cached = lines.filter(l => /CACHED|Using cache/i.test(l)).length
      const built = stdout.match(/Successfully built ([a-f0-9]+)/i)
      if (built) {
        return `built ${built[1].slice(0, 12)} (${steps} steps, ${cached} cached)`
      }
      return steps ? `${steps} steps (${cached} cached)` : null
    },
  },
]

/**
 * Minimum line count before minimization kicks in.
 * Short outputs are returned as-is.
 */
const MIN_LINES_TO_MINIMIZE = 15

/**
 * Attempt to minimize verbose command output.
 * Returns null if no rule matched or output is already short.
 */
export function minimizeOutput(
  command: string,
  stdout: string,
  stderr: string,
): MinimizeResult | null {
  const totalLines = (stdout + stderr).split('\n').length
  if (totalLines < MIN_LINES_TO_MINIMIZE) return null

  for (const rule of rules) {
    if (!rule.match(command)) continue
    const result = rule.minimize(stdout, stderr)
    if (result) {
      return {
        minimized: result,
        originalLines: totalLines,
        minimizedLines: result.split('\n').length,
        tool: rule.tool,
      }
    }
  }

  return null
}

/**
 * Generic tail minimizer — for any output over a threshold,
 * keep first N and last M lines with a "[X lines omitted]" marker.
 */
export function truncateMiddle(
  output: string,
  options?: { headLines?: number; tailLines?: number; threshold?: number },
): string {
  const { headLines = 20, tailLines = 20, threshold = 100 } = options ?? {}
  const lines = output.split('\n')
  if (lines.length <= threshold) return output

  const head = lines.slice(0, headLines)
  const tail = lines.slice(-tailLines)
  const omitted = lines.length - headLines - tailLines

  return [...head, `\n... [${omitted} lines omitted] ...\n`, ...tail].join('\n')
}
