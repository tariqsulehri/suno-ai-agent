import path from 'path'

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
  if (path.isAbsolute(filePath)) return filePath

  return path.resolve(process.cwd(), filePath)
}

export function resolveSqliteDbUrl(): string {
  return `file:${resolveSqliteDbPath()}`
}
