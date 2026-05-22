import { PrismaClient } from '../../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { resolveSqliteDbPath, resolveSqliteDbUrl } from './path'

// ── Global singletons (prevents reconnects in Next.js dev hot-reload) ──────────
const g = globalThis as unknown as {
  prisma?: PrismaClient
  rawDb?:  InstanceType<typeof Database>
}

// Prisma client — structured queries (Shop, Review, Lead)
// Uses its own internal better-sqlite3 connection via the adapter
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

// Raw better-sqlite3 — vector operations only (sqlite-vec virtual table)
// Separate connection so we can load the native extension
function getRawDb(): InstanceType<typeof Database> {
  if (!g.rawDb) {
    g.rawDb = new Database(resolveSqliteDbPath())
    sqliteVec.load(g.rawDb)
  }
  return g.rawDb
}

export const rawDb = new Proxy({} as InstanceType<typeof Database>, {
  get(_target, prop) {
    const client = getRawDb()
    const value = client[prop as keyof InstanceType<typeof Database>]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
