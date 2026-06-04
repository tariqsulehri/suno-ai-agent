import { PrismaClient } from '../../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'
import { resolveSqliteDbPath, resolveSqliteDbUrl } from './path'

// ── Global singletons (prevents reconnects in Next.js dev hot-reload) ──────────
const g = globalThis as unknown as {
  prisma?:        PrismaClient
  rawDb?:         InstanceType<typeof Database>
  vectorsEnabled?: boolean
}

// Prisma client — structured queries (Shop, Review, Lead)
function getPrisma(): PrismaClient {
  if (!g.prisma) {
    const adapter = new PrismaBetterSqlite3({ url: resolveSqliteDbUrl() })
    g.prisma = new PrismaClient({ adapter })
  }
  return g.prisma
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma()
    const value = client[prop as keyof PrismaClient]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

// Raw better-sqlite3 — vector operations only (sqlite-vec virtual table).
// sqlite-vec requires a platform binary (sqlite-vec-linux-x64 on Vercel).
// If that binary is absent the main review-save flow must not be affected,
// so we catch the load error and set vectorsEnabled=false instead of throwing.
function getRawDb(): InstanceType<typeof Database> {
  if (!g.rawDb) {
    g.rawDb = new Database(resolveSqliteDbPath())
    if (g.vectorsEnabled === undefined) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqliteVec = require('sqlite-vec') as { load: (db: InstanceType<typeof Database>) => void }
        sqliteVec.load(g.rawDb)
        g.vectorsEnabled = true
      } catch (err) {
        console.warn('[sqlite-vec] Extension unavailable — vector search disabled:', (err as Error).message)
        g.vectorsEnabled = false
      }
    }
  }
  return g.rawDb
}

/** True only when the sqlite-vec extension loaded successfully. */
export function isVectorsEnabled(): boolean {
  getRawDb()   // ensure the load attempt has run
  return g.vectorsEnabled === true
}

export const rawDb = new Proxy({} as InstanceType<typeof Database>, {
  get(_target, prop) {
    const client = getRawDb()
    const value = client[prop as keyof InstanceType<typeof Database>]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
