/**
 * Model Cache — SQLite-backed cache for provider model lists.
 * Uses bun:sqlite with WAL mode for concurrent access safety.
 * TTL: 2 hours. Supports online/offline/online-if-uncached refresh strategies.
 */

import { Database } from 'bun:sqlite'
import * as path from 'node:path'
import * as fs from 'node:fs'

export type ModelRefreshStrategy = 'online' | 'offline' | 'online-if-uncached'

export interface CachedModelEntry {
  id: string
  name: string
  provider: string
  contextWindow?: number
  maxOutputTokens?: number
  supportsVision?: boolean
  supportsTools?: boolean
  pricing?: { input: number; output: number }
}

export interface CachedProviderModels {
  providerId: string
  models: CachedModelEntry[]
  updatedAt: number
  version: number
}

const CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours
const SCHEMA_VERSION = 1

let _db: Database | null = null

function getCacheDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '~'
  const dir = path.join(home, '.legna')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getDb(): Database {
  if (!_db) {
    const dbPath = path.join(getCacheDir(), 'models.db')
    _db = new Database(dbPath)
    _db.exec('PRAGMA journal_mode=WAL')
    _db.exec('PRAGMA busy_timeout=5000')
    _db.exec(`
      CREATE TABLE IF NOT EXISTS model_cache (
        provider_id TEXT PRIMARY KEY,
        version INTEGER NOT NULL DEFAULT ${SCHEMA_VERSION},
        updated_at INTEGER NOT NULL,
        models TEXT NOT NULL,
        static_fingerprint TEXT
      )
    `)
  }
  return _db
}
/**
 * Get cached models for a provider. Returns null if not cached or expired.
 */
export function getCachedModels(providerId: string, strategy: ModelRefreshStrategy): CachedProviderModels | null {
  if (strategy === 'online') return null // Always fetch fresh

  const db = getDb()
  const row = db.query('SELECT * FROM model_cache WHERE provider_id = ?').get(providerId) as any
  if (!row) return null

  const age = Date.now() - row.updated_at
  if (strategy === 'online-if-uncached' && age > CACHE_TTL_MS) return null

  return {
    providerId: row.provider_id,
    models: JSON.parse(row.models),
    updatedAt: row.updated_at,
    version: row.version,
  }
}

/**
 * Store models for a provider in the cache.
 */
export function setCachedModels(providerId: string, models: CachedModelEntry[]): void {
  const db = getDb()
  db.query(
    `INSERT OR REPLACE INTO model_cache (provider_id, version, updated_at, models)
     VALUES (?, ?, ?, ?)`,
  ).run(providerId, SCHEMA_VERSION, Date.now(), JSON.stringify(models))
}

/**
 * Invalidate cache for a specific provider.
 */
export function invalidateCache(providerId: string): void {
  const db = getDb()
  db.query('DELETE FROM model_cache WHERE provider_id = ?').run(providerId)
}

/**
 * Invalidate all cached models.
 */
export function invalidateAllCache(): void {
  const db = getDb()
  db.query('DELETE FROM model_cache').run()
}

/**
 * Get all cached provider IDs.
 */
export function getCachedProviderIds(): string[] {
  const db = getDb()
  const rows = db.query('SELECT provider_id FROM model_cache').all() as any[]
  return rows.map(r => r.provider_id)
}

/**
 * Close the database connection (for cleanup).
 */
export function closeModelCache(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}
