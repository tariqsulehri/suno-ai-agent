import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = new Set(['pending', 'contacted', 'resolved'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let status: string
  try {
    const body = await req.json()
    status = body.status
    if (!VALID_STATUSES.has(status)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'status must be pending | contacted | resolved' }, { status: 400 })
  }

  try {
    const updated = await db.review.update({
      where: { id },
      data:  { status },
      select: { id: true, status: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }
}
