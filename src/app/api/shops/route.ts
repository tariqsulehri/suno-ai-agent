import { NextResponse } from 'next/server'
import { connectDB, Shop, User } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

// ── GET /api/shops — return all shops with demo agent credentials ──────────────
export async function GET() {
  try {
    await connectDB()
    const shops = await Shop.find().sort({ name: 1 }).lean()
    const shopIds = shops.map((s) => String(s._id))
    const agents = await User.find({ shopId: { $in: shopIds }, role: 'agent', active: true })
      .select('shopId username demoPassword')
      .lean()

    const agentMap: Record<string, { username: string; demoPassword?: string }> = {}
    for (const a of agents) {
      if (a.shopId && !agentMap[a.shopId]) agentMap[a.shopId] = a
    }

    return NextResponse.json(shops.map((s) => {
      const id = String(s._id)
      return {
        id,
        tenantId:      s.tenantId,
        name:          s.name,
        city:          s.city,
        branchCode:    s.branchCode,
        agentUsername: agentMap[id]?.username     ?? null,
        agentPassword: agentMap[id]?.demoPassword ?? null,
      }
    }))
  } catch (err) {
    console.error('[GET /api/shops]', err)
    return NextResponse.json({ error: 'Failed to fetch shops' }, { status: 500 })
  }
}
