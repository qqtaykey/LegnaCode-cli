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

type BrowserInput = z.infer<typeof inputSchema>

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
  maxResultSizeChars: 200_000,
  async description() {
    return 'Browse web pages with a real browser — navigate, click, type, screenshot, evaluate JS, extract accessibility tree'
  },
  async prompt() {
    return (
      'Use this tool to control a real headless browser. Actions:\n' +
      '- navigate: Go to a URL, returns page text content\n' +
      '- screenshot: Capture the current page as a base64 PNG image\n' +
      '- click: Click an element by CSS selector\n' +
      '- type: Type text into an input element\n' +
      '- scroll: Scroll the page up or down\n' +
      '- evaluate: Run JavaScript in the page context\n' +
      '- accessibility_tree: Get structured accessibility tree of the page'
    )
  },
  inputSchema,
  isReadOnly() {
    return true
  },
  userFacingName() {
    return 'Web Browser'
  },
  renderToolUseMessage(input: BrowserInput) {
    if (input.action === 'navigate' && input.url) {
      return `Browsing: ${input.url}`
    }
    if (input.action === 'click' && input.selector) {
      return `Clicking: ${input.selector}`
    }
    return `Web browser: ${input.action}`
  },
  mapToolResultToToolResultBlockParam(output: string, toolUseID: string) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: output || '(no output)',
    }
  },
  async call(input: BrowserInput, _ctx: any, _canUse: any, _parent: any, _progress?: any) {
    if (feature('REAL_BROWSER')) {
      return realBrowserCall(input)
    }
    return fetchOnlyCall(input)
  },
  async checkPermissions(_input: BrowserInput, _context: any): Promise<any> {
    return { behavior: 'allow' as const, updatedInput: _input }
  },
})

async function realBrowserCall(input: BrowserInput) {
  try {
    const eng = await getEngine()
    const browser = await getBrowser()

    switch (input.action) {
      case 'navigate': {
        if (!input.url) {
          return { data: 'Error: url is required for navigate action' }
        }
        const tab = await eng.openTab(browser.id, input.url)
        // Store last tab for subsequent actions
        browser.currentTabId = tab.id
        const tree = await eng.getAccessibilityTree(tab.id)
        const formatted = Array.isArray(tree)
          ? tree.map((n: any) => `[${n.role}] ${n.name}${n.value ? ` = ${n.value}` : ''}`).join('\n')
          : String(tree)
        return { data: `[Navigated] ${input.url}\n\n${formatted}` }
      }

      case 'screenshot': {
        const tabId = browser.currentTabId
        if (!tabId) {
          return { data: 'Error: no page open. Use navigate first.' }
        }
        const buf = await eng.screenshotTab(tabId)
        const base64 = Buffer.isBuffer(buf) ? buf.toString('base64') : String(buf)
        return { data: `[Screenshot captured]\ndata:image/png;base64,${base64.slice(0, 100)}...` }
      }

      case 'click': {
        if (!input.selector) {
          return { data: 'Error: selector is required for click action' }
        }
        const tabId = browser.currentTabId
        if (!tabId) {
          return { data: 'Error: no page open. Use navigate first.' }
        }
        await eng.clickElement(tabId, input.selector)
        return { data: `Clicked: ${input.selector}` }
      }

      case 'type': {
        if (!input.selector || !input.text) {
          return { data: 'Error: selector and text are required for type action' }
        }
        const tabId = browser.currentTabId
        if (!tabId) {
          return { data: 'Error: no page open. Use navigate first.' }
        }
        await eng.typeInElement(tabId, input.selector, input.text)
        return { data: `Typed "${input.text}" into ${input.selector}` }
      }

      case 'scroll': {
        const tabId = browser.currentTabId
        if (!tabId) {
          return { data: 'Error: no page open. Use navigate first.' }
        }
        const dir = input.direction ?? 'down'
        const amt = input.amount ?? 500
        // scrollPage not exported from engine — use page.evaluate directly
        const tab = (eng as any)._tabs?.get(tabId)
        if (tab?.page) {
          await tab.page.evaluate(`window.scrollBy(0, ${dir === 'down' ? amt : -amt})`)
        }
        return { data: `Scrolled ${dir} ${amt}px` }
      }

      case 'evaluate': {
        if (!input.script) {
          return { data: 'Error: script is required for evaluate action' }
        }
        const tabId = browser.currentTabId
        if (!tabId) {
          return { data: 'Error: no page open. Use navigate first.' }
        }
        // Access the tab's page directly for evaluate
        const tab = (eng as any)._tabs?.get(tabId)
        if (!tab?.page) {
          return { data: 'Error: tab page not accessible' }
        }
        const result = await tab.page.evaluate(input.script)
        return { data: String(result) }
      }

      case 'accessibility_tree': {
        const tabId = browser.currentTabId
        if (!tabId) {
          return { data: 'Error: no page open. Use navigate first.' }
        }
        const tree = await eng.getAccessibilityTree(tabId)
        const formatted = Array.isArray(tree)
          ? tree.map((n: any) => `[${n.role}] ${n.name}${n.value ? ` = ${n.value}` : ''}`).join('\n')
          : String(tree)
        return { data: formatted }
      }

      default:
        return { data: `Unknown action: ${input.action}` }
    }
  } catch (e: any) {
    logForDebugging(`WebBrowser engine error: ${e}`)
    return { data: `Browser error: ${e.message ?? e}` }
  }
}

async function fetchOnlyCall(input: BrowserInput) {
  if (input.action === 'navigate') {
    if (!input.url) {
      return { data: 'Error: url is required for navigate action' }
    }
    try {
      const response = await fetch(input.url, {
        headers: { 'User-Agent': 'LegnaCode/2.1 (CLI Browser Tool)' },
        redirect: 'follow',
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text') && !contentType.includes('json')) {
        return { data: `Fetched ${input.url} (${response.status}) — binary content (${contentType}), cannot display` }
      }
      const text = await response.text()
      const cleaned = text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50000)
      return { data: `[${response.status}] ${input.url}\n\n${cleaned}` }
    } catch (e) {
      return { data: `Error fetching ${input.url}: ${e}` }
    }
  }

  return { data: `Action "${input.action}" requires REAL_BROWSER feature flag to be enabled.` }
}
