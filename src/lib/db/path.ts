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

  // ── Read-only check (works on Vercel, Railway, any read-only bundle) ──────────
  // Rather than guessing the runtime environment from env vars or path prefixes,
  // we probe the file directly: if it exists but is not writable (Vercel bundles
  // /var/task as read-only), redirect all I/O to /tmp/dev.db which is always
  // writable in serverless environments.
  if (fs.existsSync(resolved)) {
    const writable = (() => {
      try { fs.accessSync(resolved, fs.constants.W_OK); return true }
      catch { return false }
    })()

    if (!writable) {
      const tmp = '/tmp/dev.db'
      if (!fs.existsSync(tmp)) {
        fs.copyFileSync(resolved, tmp)
      }
      return tmp
    }

    return resolved   // file exists and is writable — use it (local dev, custom path)
  }

  // ── File doesn't exist yet ────────────────────────────────────────────────────
  // Happens on first cold-start when DATABASE_URL points to an empty /tmp,
  // or on a self-hosted server with a fresh data directory.
  const seed = path.join(process.cwd(), 'dev.db')
  if (fs.existsSync(seed) && seed !== resolved) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true })
    fs.copyFileSync(seed, resolved)
  }
  return resolved
}

export function resolveSqliteDbUrl(): string {
  return `file:${resolveSqliteDbPath()}`
}
