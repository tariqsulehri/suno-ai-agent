import path from 'path'
import fs   from 'fs'

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

export function resolveSqliteDbPath(): string {
  const rawUrl = stripWrappingQuotes(
    process.env.DATABASE_URL || `file:${path.join(process.cwd(), 'dev.db')}`
  )

  if (!rawUrl.startsWith('file:')) return rawUrl

  const filePath = rawUrl.replace(/^file:/, '')
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath)

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const isWritable = (p: string) => {
    try { fs.accessSync(p, fs.constants.W_OK); return true } catch { return false }
  }
  const exists = (p: string) => {
    try { return fs.existsSync(p) && fs.statSync(p).size > 0 } catch { return false }
  }

  // ── 1. Resolved path is writable → use it directly (local dev, /tmp already) ──
  if (exists(resolved) && isWritable(resolved)) return resolved

  // ── 2. Find the bundled seed file ────────────────────────────────────────────
  // Vercel places traced files at /var/task/<original-relative-path>.
  // We check several candidates so this works regardless of cwd at runtime.
  const seedCandidates = [
    path.join(process.cwd(), 'dev.db'),            // /var/task/dev.db (Vercel)
    '/var/task/dev.db',                            // explicit fallback
    path.resolve(__dirname, '../../../dev.db'),    // from src/lib/db → root
    path.resolve(__dirname, '../../../../dev.db'), // one level deeper
  ]
  const seed = seedCandidates.find(c => exists(c) && c !== resolved) ?? null

  // ── 3. Always write to /tmp/dev.db in read-only environments ────────────────
  const tmp = '/tmp/dev.db'
  if (!exists(tmp) && seed) {
    try {
      fs.copyFileSync(seed, tmp)
    } catch (err) {
      console.error('[db/path] Failed to seed /tmp/dev.db:', err)
    }
  }

  // If /tmp is usable (Vercel or any read-only deploy), return it
  if (exists(resolved) && !isWritable(resolved)) return tmp   // file read-only
  if (!exists(resolved) && exists(tmp))          return tmp   // file absent, /tmp seeded

  // ── 4. Local: resolved doesn't exist yet — create it from seed ───────────────
  if (!exists(resolved) && seed) {
    try {
      fs.mkdirSync(path.dirname(resolved), { recursive: true })
      fs.copyFileSync(seed, resolved)
    } catch { /* directory read-only — /tmp was already returned above */ }
  }
  return resolved
}

export function resolveSqliteDbUrl(): string {
  return `file:${resolveSqliteDbPath()}`
}
