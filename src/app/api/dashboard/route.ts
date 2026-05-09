import { NextRequest, NextResponse } from 'next/server'
import { getDashboardData } from '@/lib/db/dashboard-query'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    const data = await getDashboardData()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[dashboard]', err)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
