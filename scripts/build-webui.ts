/**
 * Build the admin WebUI and inline it into src/server/admin-ui-html.ts.
 * Usage: bun run scripts/build-webui.ts
 */
import { resolve } from 'path'
import { execSync } from 'child_process'

const ROOT = resolve(import.meta.dir, '..')
const WEBUI = resolve(ROOT, 'webui')

console.log('Building admin WebUI...')
execSync('npm install --no-audit --no-fund', { cwd: WEBUI, stdio: 'inherit' })
execSync('npm run build', { cwd: WEBUI, stdio: 'inherit' })
console.log('Inlining into admin-ui-html.ts...')
execSync('bun run scripts/inline-webui.ts', { cwd: ROOT, stdio: 'inherit' })
console.log('Done.')
