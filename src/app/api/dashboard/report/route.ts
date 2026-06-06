import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth/session'
import { getShopReport, type ReportFilters } from '@/lib/db/report-query'

export const dynamic = 'force-dynamic'

function parseList(param: string | null): string[] | undefined {
  if (!param) return undefined
  const items = param.split(',').map((s) => s.trim()).filter(Boolean)
  return items.length ? items : undefined
}

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl

  const dateFrom = searchParams.get('dateFrom') ?? undefined
  const dateTo   = searchParams.get('dateTo')   ?? undefined

  if (dateFrom && isNaN(Date.parse(dateFrom))) {
    return NextResponse.json({ error: 'Invalid dateFrom' }, { status: 400 })
  }
  if (dateTo && isNaN(Date.parse(dateTo))) {
    return NextResponse.json({ error: 'Invalid dateTo' }, { status: 400 })
  }

  const filters: ReportFilters = {
    dateFrom,
    dateTo,
    provinces:  parseList(searchParams.get('provinces')),
    cities:     parseList(searchParams.get('cities')),
    categories: parseList(searchParams.get('categories')),
    sentiments: parseList(searchParams.get('sentiments')),
  }

  // Managers are scoped to their own shop — cannot be overridden
  if (session.role === 'manager') {
    filters.shopIds = session.shopId ? [session.shopId] : []
  } else {
    filters.shopIds = parseList(searchParams.get('shopIds'))
  }

  try {
    const data = await getShopReport(filters)
    return NextResponse.json(data)
  } catch (err) {
    console.error('[dashboard/report]', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
