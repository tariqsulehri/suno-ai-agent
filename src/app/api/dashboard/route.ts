import { NextRequest, NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/db/dashboard-query'
import { getSessionFromRequest } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const data = await getDashboardData({
      shopId: session.role === 'manager' ? session.shopId : null,
    })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[dashboard]', err)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
