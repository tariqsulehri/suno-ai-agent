import { NextRequest, NextResponse } from 'next/server'
import { connectDB, Review } from '@/lib/db/client'

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
    await connectDB()
    const updated = await Review.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true, select: '_id status' },
    ).lean()
    if (!updated) throw new Error('not found')
    return NextResponse.json({ id: String(updated._id), status: updated.status })
  } catch {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }
}
