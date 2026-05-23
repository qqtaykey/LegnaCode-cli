/**
 * Python Kernel Manager — manages long-lived Python subprocess.
 * Communicates via NDJSON over stdin/stdout.
 * Supports: execute, complete, inspect, exit messages.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import * as path from 'node:path'
import { resolvePythonRuntime, buildPythonEnv } from './runtime.js'

export interface KernelMessage {
  type: 'execute' | 'complete' | 'inspect' | 'exit'
  id: string
  code?: string
  cursor?: number
}

export interface KernelResponse {
  type: 'result' | 'error' | 'display' | 'stdout' | 'stderr' | 'complete' | 'inspect'
  id: string
  text?: string
  traceback?: string
  data?: Record<string, string> // MIME type → content (e.g., image/png → base64)
  completions?: string[]
}

export interface KernelState {
  process: ChildProcess
  ready: boolean
  pendingCallbacks: Map<string, (response: KernelResponse) => void>
  buffer: string
}

const _kernels = new Map<string, KernelState>()
let _nextMsgId = 1

function generateMsgId(): string {
  return `msg_${_nextMsgId++}`
}

/**
 * Start a Python kernel for a session.
 */
export async function startKernel(sessionId: string, cwd: string): Promise<void> {
  if (_kernels.has(sessionId)) return // Already running

  const runtime = await resolvePythonRuntime(cwd)
  const env = buildPythonEnv(runtime)
  const runnerPath = path.join(__dirname, 'runner.py')

  const proc = spawn(runtime.executable, ['-u', runnerPath], {
    cwd,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  const state: KernelState = {
    process: proc,
    ready: false,
    pendingCallbacks: new Map(),
    buffer: '',
  }

  // Handle stdout (NDJSON responses)
  proc.stdout!.on('data', (chunk: Buffer) => {
    state.buffer += chunk.toString()
    const lines = state.buffer.split('\n')
    state.buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const response: KernelResponse = JSON.parse(line)
        if (response.id === 'ready') {
          state.ready = true
          continue
        }
        const callback = state.pendingCallbacks.get(response.id)
        if (callback) {
          callback(response)
          state.pendingCallbacks.delete(response.id)
        }
      } catch {}
    }
  })

  proc.on('exit', () => {
    _kernels.delete(sessionId)
  })

  _kernels.set(sessionId, state)

  // Wait for ready signal (timeout 10s)
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Kernel startup timeout')), 10000)
    const check = setInterval(() => {
      if (state.ready) { clearInterval(check); clearTimeout(timeout); resolve() }
    }, 50)
    proc.on('exit', () => { clearInterval(check); clearTimeout(timeout); reject(new Error('Kernel exited')) })
  })
}

/**
 * Execute code in a kernel session.
 */
export async function executeCode(sessionId: string, code: string): Promise<KernelResponse> {
  const state = _kernels.get(sessionId)
  if (!state || !state.ready) throw new Error(`Kernel ${sessionId} not ready`)

  const id = generateMsgId()
  const msg: KernelMessage = { type: 'execute', id, code }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      state.pendingCallbacks.delete(id)
      reject(new Error('Execution timeout'))
    }, 60000) // 60s timeout

    state.pendingCallbacks.set(id, (response) => {
      clearTimeout(timeout)
      resolve(response)
    })

    state.process.stdin!.write(JSON.stringify(msg) + '\n')
  })
}

/**
 * Stop a kernel session.
 */
export async function stopKernel(sessionId: string): Promise<void> {
  const state = _kernels.get(sessionId)
  if (!state) return

  // Try graceful exit
  try {
    state.process.stdin!.write(JSON.stringify({ type: 'exit', id: 'exit' }) + '\n')
  } catch {}

  // SIGINT → SIGTERM → SIGKILL escalation
  state.process.kill('SIGINT')
  await new Promise(r => setTimeout(r, 1000))

  if (!state.process.killed) {
    state.process.kill('SIGTERM')
    await new Promise(r => setTimeout(r, 3000))
  }

  if (!state.process.killed) {
    state.process.kill('SIGKILL')
  }

  _kernels.delete(sessionId)
}

/**
 * Check if a kernel is running for a session.
 */
export function isKernelRunning(sessionId: string): boolean {
  return _kernels.has(sessionId) && (_kernels.get(sessionId)?.ready ?? false)
}

/**
 * Stop all running kernels (cleanup on exit).
 */
export async function stopAllKernels(): Promise<void> {
  for (const sessionId of _kernels.keys()) {
    await stopKernel(sessionId)
  }
}
