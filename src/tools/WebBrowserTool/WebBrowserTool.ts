/**
 * WebBrowserTool — real browser control via puppeteer-core + CDP.
 * Falls back to fetch-based approach only when REAL_BROWSER flag is off.
 * Gated by feature('WEB_BROWSER_TOOL').
 */
import { z } from 'zod'
import { feature } from 'bun:bundle'
import { buildTool } from '../../Tool.js'
import { logForDebugging } from '../../utils/debug.js'

const WEB_BROWSER_TOOL_NAME = 'WebBrowser'

const inputSchema = z.object({
  action: z.enum(['navigate', 'screenshot', 'click', 'type', 'scroll', 'evaluate', 'accessibility_tree']).describe(
    'Action to perform on the browser page',
  ),
  url: z.string().optional().describe('URL to navigate to (required for navigate)'),
  selector: z.string().optional().describe('CSS selector for click/type actions'),
  text: z.string().optional().describe('Text to type (for type action)'),
  script: z.string().optional().describe('JavaScript to evaluate (for evaluate action)'),
  direction: z.enum(['up', 'down']).optional().describe('Scroll direction'),
  amount: z.number().optional().describe('Scroll amount in pixels (default 500)'),
})

// Lazy-loaded engine reference
let engine: typeof import('./engine/index.js') | null = null
let browserInstance: any = null

async function getEngine() {
  if (!engine) {
    engine = await import('./engine/index.js')
  }
  return engine
}

async function getBrowser() {
  if (!browserInstance) {
    const eng = await getEngine()
    browserInstance = await eng.launchBrowser({ mode: 'headless' })
  }
  return browserInstance
}

export const WebBrowserTool = buildTool({
  name: WEB_BROWSER_TOOL_NAME,
  description: 'Browse web pages with a real browser — navigate, click, type, screenshot, evaluate JS, extract accessibility tree',
  searchHint: 'web browser navigate screenshot click type accessibility',
  inputSchema,
  isReadOnly: () => true,
  prompt: () =>
    'Use this tool to control a real headless browser. Actions:\n' +
    '- navigate: Go to a URL, returns page text content\n' +
    '- screenshot: Capture the current page as a base64 PNG image\n' +
    '- click: Click an element by CSS selector\n' +
    '- type: Type text into an input element\n' +
    '- scroll: Scroll the page up or down\n' +
    '- evaluate: Run JavaScript in the page context\n' +
    '- accessibility_tree: Get structured accessibility tree of the page',
  userFacingName: () => 'Web Browser',
  renderToolUseMessage(input: z.infer<typeof inputSchema>) {
    if (input.action === 'navigate' && input.url) {
      return `Browsing: ${input.url}`
    }
    if (input.action === 'click' && input.selector) {
      return `Clicking: ${input.selector}`
    }
    return `Web browser: ${input.action}`
  },
  renderToolResultMessage(result: unknown) {
    if (typeof result === 'string') return result
    const r = result as { type?: string; text?: string }
    return r?.text ?? JSON.stringify(result)
  },
  async call(input: z.infer<typeof inputSchema>) {
    // Use real browser when REAL_BROWSER flag is enabled
    if (feature('REAL_BROWSER')) {
      return realBrowserCall(input)
    }
    // Fallback to fetch-only mode
    return fetchOnlyCall(input)
  },
})

async function realBrowserCall(input: z.infer<typeof inputSchema>) {
  try {
    const eng = await getEngine()
    const browser = await getBrowser()

    switch (input.action) {
      case 'navigate': {
        if (!input.url) {
          return { type: 'text' as const, text: 'Error: url is required for navigate action' }
        }
        const page = await eng.openTab(browser, input.url)
        const tree = await eng.getAccessibilityTree(page)
        return { type: 'text' as const, text: `[Navigated] ${input.url}\n\n${tree}` }
      }

      case 'screenshot': {
        const page = browser.currentPage
        if (!page) {
          return { type: 'text' as const, text: 'Error: no page open. Use navigate first.' }
        }
        const base64 = await eng.screenshotTab(page)
        return { type: 'image' as const, source: { type: 'base64', media_type: 'image/png', data: base64 } }
      }

      case 'click': {
        if (!input.selector) {
          return { type: 'text' as const, text: 'Error: selector is required for click action' }
        }
        const page = browser.currentPage
        if (!page) {
          return { type: 'text' as const, text: 'Error: no page open. Use navigate first.' }
        }
        await eng.clickElement(page, input.selector)
        return { type: 'text' as const, text: `Clicked: ${input.selector}` }
      }

      case 'type': {
        if (!input.selector || !input.text) {
          return { type: 'text' as const, text: 'Error: selector and text are required for type action' }
        }
        const page = browser.currentPage
        if (!page) {
          return { type: 'text' as const, text: 'Error: no page open. Use navigate first.' }
        }
        await eng.typeInElement(page, input.selector, input.text)
        return { type: 'text' as const, text: `Typed "${input.text}" into ${input.selector}` }
      }

      case 'scroll': {
        const page = browser.currentPage
        if (!page) {
          return { type: 'text' as const, text: 'Error: no page open. Use navigate first.' }
        }
        const amount = input.amount ?? 500
        const dir = input.direction === 'up' ? -amount : amount
        await page.evaluate((scrollY: number) => window.scrollBy(0, scrollY), dir)
        return { type: 'text' as const, text: `Scrolled ${input.direction ?? 'down'} ${amount}px` }
      }

      case 'evaluate': {
        if (!input.script) {
          return { type: 'text' as const, text: 'Error: script is required for evaluate action' }
        }
        const page = browser.currentPage
        if (!page) {
          return { type: 'text' as const, text: 'Error: no page open. Use navigate first.' }
        }
        const result = await page.evaluate(input.script)
        return { type: 'text' as const, text: String(result) }
      }

      case 'accessibility_tree': {
        const page = browser.currentPage
        if (!page) {
          return { type: 'text' as const, text: 'Error: no page open. Use navigate first.' }
        }
        const tree = await eng.getAccessibilityTree(page)
        return { type: 'text' as const, text: tree }
      }

      default:
        return { type: 'text' as const, text: `Unknown action: ${input.action}` }
    }
  } catch (e: any) {
    logForDebugging(`WebBrowser engine error: ${e}`)
    return { type: 'text' as const, text: `Browser error: ${e.message ?? e}` }
  }
}

async function fetchOnlyCall(input: z.infer<typeof inputSchema>) {
  if (input.action === 'navigate') {
    if (!input.url) {
      return { type: 'text' as const, text: 'Error: url is required for navigate action' }
    }
    try {
      const response = await fetch(input.url, {
        headers: { 'User-Agent': 'LegnaCode/2.1 (CLI Browser Tool)' },
        redirect: 'follow',
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text') && !contentType.includes('json')) {
        return { type: 'text' as const, text: `Fetched ${input.url} (${response.status}) — binary content (${contentType}), cannot display` }
      }
      const text = await response.text()
      const cleaned = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50000)
      return { type: 'text' as const, text: `[${response.status}] ${input.url}\n\n${cleaned}` }
    } catch (e) {
      return { type: 'text' as const, text: `Error fetching ${input.url}: ${e}` }
    }
  }

  return { type: 'text' as const, text: `Action "${input.action}" requires REAL_BROWSER feature flag to be enabled.` }
}
