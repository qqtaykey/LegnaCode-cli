/**
 * System theme watcher — queries the terminal's background color via OSC 11
 * and watches for live changes. Used by AUTO_THEME to resolve 'auto' theme.
 */
import type { SystemTheme } from './systemTheme.js'
import { setCachedSystemTheme, themeFromOscColor } from './systemTheme.js'
import { logForDebugging } from './debug.js'

// OSC 11 query: request terminal background color
const OSC_11_QUERY = '\x1b]11;?\x07'

/**
 * Start watching the terminal's background color.
 * Sends an OSC 11 query on start and periodically (every 30s) to detect
 * theme changes (e.g. macOS auto dark mode switching at sunset).
 *
 * Returns a cleanup function to stop watching.
 */
export function watchSystemTheme(
  _querier: unknown,
  onThemeChange: (theme: SystemTheme) => void,
): () => void {
  let stopped = false
  let timer: ReturnType<typeof setInterval> | undefined

  function query(): void {
    if (stopped) return
    try {
      // Write OSC 11 query to stdout. The terminal responds with the
      // background color in the stdin stream, which we parse below.
      if (process.stdout.isTTY) {
        process.stdout.write(OSC_11_QUERY)
      }
    } catch {
      // Ignore write errors (pipe closed, etc.)
    }
  }

  // Listen for OSC 11 responses on stdin
  function onData(data: Buffer): void {
    const str = data.toString()
    // OSC 11 response format: ESC ] 11 ; <color> BEL/ST
    const match = /\x1b\]11;([^\x07\x1b]+)[\x07\x1b]/.exec(str)
    if (!match) return
    const theme = themeFromOscColor(match[1]!)
    if (theme) {
      setCachedSystemTheme(theme)
      onThemeChange(theme)
      logForDebugging(`SystemTheme: detected ${theme} from OSC 11`)
    }
  }

  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.on('data', onData)
    query()
    // Re-query periodically to catch live theme changes
    timer = setInterval(query, 30_000)
    timer.unref()
  }

  return () => {
    stopped = true
    if (timer) clearInterval(timer)
    process.stdin.off('data', onData)
  }
}
