import { NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

// ── GET /api/shops — return all shops ordered by name ─────────────────────────
export async function GET() {
  try {
    const shops = await db.shop.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(shops)
  } catch (err) {
    console.error('[GET /api/shops]', err)
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 })
  }
}
