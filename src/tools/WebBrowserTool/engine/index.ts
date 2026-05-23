/**
 * Browser Engine — manages browser instances via puppeteer-core + CDP.
 *
 * Three launch modes:
 * - headless: auto-downloads Chromium, runs headless
 * - spawned: launches arbitrary binary (e.g., Electron app)
 * - connected: attaches to existing CDP endpoint
 */

export type BrowserMode = 'headless' | 'spawned' | 'connected'

export interface BrowserLaunchOptions {
  mode: BrowserMode
  /** Path to Chrome/Chromium binary (headless/spawned mode) */
  executablePath?: string
  /** CDP WebSocket URL (connected mode) */
  cdpUrl?: string
  /** Whether to run headless (default: true) */
  headless?: boolean
  /** Extra args passed to the browser */
  args?: string[]
  /** Viewport width */
  viewportWidth?: number
  /** Viewport height */
  viewportHeight?: number
  /** Apply stealth scripts to avoid bot detection */
  stealth?: boolean
}

export interface BrowserHandle {
  id: string
  mode: BrowserMode
  browser: any // puppeteer Browser instance
  refCount: number
  createdAt: number
}

export interface TabHandle {
  id: string
  browserId: string
  page: any // puppeteer Page instance
  url: string
}

export interface PageSnapshot {
  url: string
  title: string
  accessibilityTree?: AccessibilityNode[]
  screenshot?: Buffer
}

export interface AccessibilityNode {
  role: string
  name: string
  value?: string
  children?: AccessibilityNode[]
  target?: string
}

// Browser instance registry
const _browsers = new Map<string, BrowserHandle>()
const _tabs = new Map<string, TabHandle>()
let _nextId = 1

function generateId(prefix: string): string {
  return `${prefix}_${_nextId++}`
}

/**
 * Launch or connect to a browser instance.
 */
export async function launchBrowser(options: BrowserLaunchOptions): Promise<BrowserHandle> {
  // Lazy-load puppeteer-core to avoid startup cost
  const puppeteer = await import('puppeteer-core')

  let browser: any

  switch (options.mode) {
    case 'headless': {
      const execPath = options.executablePath || await findChromePath()
      browser = await puppeteer.launch({
        executablePath: execPath,
        headless: options.headless !== false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          `--window-size=${options.viewportWidth ?? 1280},${options.viewportHeight ?? 720}`,
          ...(options.args ?? []),
        ],
      })
      break
    }
    case 'spawned': {
      if (!options.executablePath) throw new Error('executablePath required for spawned mode')
      browser = await puppeteer.launch({
        executablePath: options.executablePath,
        headless: false,
        args: options.args ?? [],
      })
      break
    }
    case 'connected': {
      if (!options.cdpUrl) throw new Error('cdpUrl required for connected mode')
      browser = await puppeteer.connect({ browserWSEndpoint: options.cdpUrl })
      break
    }
  }

  const handle: BrowserHandle = {
    id: generateId('browser'),
    mode: options.mode,
    browser,
    refCount: 1,
    createdAt: Date.now(),
  }

  _browsers.set(handle.id, handle)

  // Apply stealth if requested
  if (options.stealth !== false) {
    await applyStealthScripts(browser)
  }

  return handle
}

/**
 * Open a new tab in a browser instance.
 */
export async function openTab(browserId: string, url?: string): Promise<TabHandle> {
  const handle = _browsers.get(browserId)
  if (!handle) throw new Error(`Browser ${browserId} not found`)

  const page = await handle.browser.newPage()
  if (url) await page.goto(url, { waitUntil: 'domcontentloaded' })

  const tab: TabHandle = {
    id: generateId('tab'),
    browserId,
    page,
    url: url ?? 'about:blank',
  }

  _tabs.set(tab.id, tab)
  return tab
}

/**
 * Navigate a tab to a URL.
 */
export async function navigateTab(tabId: string, url: string): Promise<void> {
  const tab = _tabs.get(tabId)
  if (!tab) throw new Error(`Tab ${tabId} not found`)
  await tab.page.goto(url, { waitUntil: 'domcontentloaded' })
  tab.url = url
}

/**
 * Take a screenshot of a tab.
 */
export async function screenshotTab(tabId: string): Promise<Buffer> {
  const tab = _tabs.get(tabId)
  if (!tab) throw new Error(`Tab ${tabId} not found`)
  return await tab.page.screenshot({ type: 'png' })
}

/**
 * Get the accessibility tree of a tab (structured page understanding).
 */
export async function getAccessibilityTree(tabId: string): Promise<AccessibilityNode[]> {
  const tab = _tabs.get(tabId)
  if (!tab) throw new Error(`Tab ${tabId} not found`)

  const snapshot = await tab.page.accessibility.snapshot()
  return snapshot ? flattenAccessibilityTree(snapshot) : []
}

/**
 * Click an element by selector or accessibility target.
 */
export async function clickElement(tabId: string, selector: string): Promise<void> {
  const tab = _tabs.get(tabId)
  if (!tab) throw new Error(`Tab ${tabId} not found`)
  await tab.page.click(selector)
}

/**
 * Type text into an element.
 */
export async function typeInElement(tabId: string, selector: string, text: string): Promise<void> {
  const tab = _tabs.get(tabId)
  if (!tab) throw new Error(`Tab ${tabId} not found`)
  await tab.page.type(selector, text)
}

/**
 * Close a tab.
 */
export async function closeTab(tabId: string): Promise<void> {
  const tab = _tabs.get(tabId)
  if (!tab) return
  await tab.page.close()
  _tabs.delete(tabId)
}

/**
 * Close a browser instance.
 */
export async function closeBrowser(browserId: string): Promise<void> {
  const handle = _browsers.get(browserId)
  if (!handle) return

  // Close all tabs for this browser
  for (const [tabId, tab] of _tabs) {
    if (tab.browserId === browserId) {
      await tab.page.close().catch(() => {})
      _tabs.delete(tabId)
    }
  }

  if (handle.mode !== 'connected') {
    await handle.browser.close()
  } else {
    handle.browser.disconnect()
  }
  _browsers.delete(browserId)
}

// ── Internal helpers ──────────────────────────────────────────

async function findChromePath(): Promise<string> {
  const { platform } = await import('os')
  const os = platform()

  const paths: string[] = []
  if (os === 'darwin') {
    paths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    )
  } else if (os === 'linux') {
    paths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    )
  } else {
    paths.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    )
  }

  const { existsSync } = await import('fs')
  for (const p of paths) {
    if (existsSync(p)) return p
  }

  throw new Error(
    'Chrome/Chromium not found. Set browser.chromePath in settings or install Chrome.',
  )
}

async function applyStealthScripts(browser: any): Promise<void> {
  // Stealth scripts prevent bot detection by patching navigator properties,
  // WebGL fingerprinting, etc. Applied via evaluateOnNewDocument.
  const stealthPatches = [
    // Hide webdriver flag
    `Object.defineProperty(navigator, 'webdriver', { get: () => undefined })`,
    // Fake plugins
    `Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })`,
    // Fake languages
    `Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] })`,
    // Chrome runtime
    `window.chrome = { runtime: {} }`,
  ]

  const pages = await browser.pages()
  for (const page of pages) {
    for (const script of stealthPatches) {
      await page.evaluateOnNewDocument(script)
    }
  }

  // Apply to future pages
  browser.on('targetcreated', async (target: any) => {
    const page = await target.page()
    if (page) {
      for (const script of stealthPatches) {
        await page.evaluateOnNewDocument(script)
      }
    }
  })
}

function flattenAccessibilityTree(node: any, depth = 0): AccessibilityNode[] {
  const result: AccessibilityNode[] = []
  if (node.role && node.role !== 'none') {
    result.push({
      role: node.role,
      name: node.name || '',
      value: node.value,
      target: node.name ? `[aria-label="${node.name}"]` : undefined,
    })
  }
  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenAccessibilityTree(child, depth + 1))
    }
  }
  return result
}
