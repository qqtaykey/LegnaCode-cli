/**
 * Python Runtime Resolver — finds the best Python executable.
 * Checks venv, conda, system Python in priority order.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

export interface PythonRuntime {
  executable: string
  version?: string
  isVenv: boolean
  venvPath?: string
}

/**
 * Resolve the best Python executable for the current project.
 * Priority: VIRTUAL_ENV > CONDA_PREFIX > .venv/ > python3 > python
 */
export async function resolvePythonRuntime(cwd: string): Promise<PythonRuntime> {
  // 1. Check VIRTUAL_ENV
  if (process.env.VIRTUAL_ENV) {
    const exe = path.join(process.env.VIRTUAL_ENV, 'bin', 'python')
    if (fs.existsSync(exe)) {
      return { executable: exe, isVenv: true, venvPath: process.env.VIRTUAL_ENV }
    }
  }

  // 2. Check CONDA_PREFIX
  if (process.env.CONDA_PREFIX) {
    const exe = path.join(process.env.CONDA_PREFIX, 'bin', 'python')
    if (fs.existsSync(exe)) {
      return { executable: exe, isVenv: true, venvPath: process.env.CONDA_PREFIX }
    }
  }

  // 3. Check local .venv/
  const localVenv = path.join(cwd, '.venv', 'bin', 'python')
  if (fs.existsSync(localVenv)) {
    return { executable: localVenv, isVenv: true, venvPath: path.join(cwd, '.venv') }
  }

  // 4. Check venv/
  const venvDir = path.join(cwd, 'venv', 'bin', 'python')
  if (fs.existsSync(venvDir)) {
    return { executable: venvDir, isVenv: true, venvPath: path.join(cwd, 'venv') }
  }

  // 5. System python3
  try {
    const { execSync } = await import('child_process')
    const python3 = execSync('which python3', { encoding: 'utf-8' }).trim()
    if (python3) return { executable: python3, isVenv: false }
  } catch {}

  // 6. System python
  try {
    const { execSync } = await import('child_process')
    const python = execSync('which python', { encoding: 'utf-8' }).trim()
    if (python) return { executable: python, isVenv: false }
  } catch {}

  throw new Error('Python not found. Install Python 3 or activate a virtual environment.')
}

/**
 * Build a sanitized environment for the Python subprocess.
 * Strips API keys and sensitive vars, keeps PATH/HOME/LANG.
 */
export function buildPythonEnv(runtime: PythonRuntime): Record<string, string> {
  const allowlist = [
    'PATH', 'HOME', 'USER', 'LANG', 'LC_ALL', 'TERM',
    'PYTHONPATH', 'PYTHONHOME', 'VIRTUAL_ENV', 'CONDA_PREFIX',
    'TMPDIR', 'TMP', 'TEMP',
  ]

  const env: Record<string, string> = {}
  for (const key of allowlist) {
    if (process.env[key]) env[key] = process.env[key]!
  }

  if (runtime.venvPath) {
    env.VIRTUAL_ENV = runtime.venvPath
    env.PATH = `${path.join(runtime.venvPath, 'bin')}:${env.PATH ?? ''}`
  }

  return env
}
