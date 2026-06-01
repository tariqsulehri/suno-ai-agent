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

  // On Vercel (and any read-only deployment), DATABASE_URL points to /tmp.
  // The /tmp directory is writable but starts empty on each cold start.
  // If the target path doesn't exist yet, seed it from the bundled dev.db.
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
