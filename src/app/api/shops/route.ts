import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

// ── GET /api/shops — return all shops with demo agent credentials ──────────────
export async function GET() {
  try {
    const shops = await db.shop.findMany({
      orderBy: { name: 'asc' },
      include: {
        users: {
          where:  { role: 'agent', active: true },
          select: { username: true, demoPassword: true },
          take:   1,
        },
      },
    })
    return NextResponse.json(shops.map(({ users, ...s }) => ({
      ...s,
      agentUsername: users[0]?.username     ?? null,
      agentPassword: users[0]?.demoPassword ?? null,
    })))
  } catch (err) {
    console.error('[GET /api/shops]', err)
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 })
  }
}
