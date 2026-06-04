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

  // ── Vercel / read-only bundle detection ──────────────────────────────────────
  // Vercel serverless functions run from /var/task which is read-only.
  // process.env.VERCEL is automatically set to '1' on all Vercel deployments.
  // Without DATABASE_URL the resolved path would be inside the bundle, which
  // would make every db.review.create() throw "attempt to write a readonly database".
  // Solution: always redirect to /tmp (writable, per-instance ephemeral storage)
  // and seed it from the bundled read-only copy if it doesn't exist yet.
  const isReadOnlyDeploy =
    Boolean(process.env.VERCEL) ||
    resolved.startsWith('/var/task') ||
    resolved.startsWith('/var/runtime')

  if (isReadOnlyDeploy) {
    const tmp = '/tmp/dev.db'
    if (!fs.existsSync(tmp)) {
      // Copy the bundled snapshot — resolved is the read-only source
      if (fs.existsSync(resolved)) {
        fs.copyFileSync(resolved, tmp)
      }
    }
    return tmp
  }

  // ── Local / non-Vercel ────────────────────────────────────────────────────────
  // Seed the target file if it doesn't exist yet (e.g. DATABASE_URL points to
  // an empty /tmp on a self-hosted server that starts fresh).
  if (!fs.existsSync(resolved)) {
    const seed = path.join(process.cwd(), 'dev.db')
    if (fs.existsSync(seed)) {
      fs.mkdirSync(path.dirname(resolved), { recursive: true })
      fs.copyFileSync(seed, resolved)
    }
  }

  return resolved
}

export function resolveSqliteDbUrl(): string {
  return `file:${resolveSqliteDbPath()}`
}
