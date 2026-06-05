import { NextRequest, NextResponse } from 'next/server'
import { connectDB, Lead } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  let name: string | undefined
  let phone: string | undefined
  let email: string | undefined

  try {
    const body = await req.json()
    if (typeof body.name  === 'string') name  = body.name.trim()  || null as unknown as string
    if (typeof body.phone === 'string') phone = body.phone.trim() || null as unknown as string
    if (typeof body.email === 'string') email = body.email.trim() || null as unknown as string
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    await connectDB()
    const updated = await Lead.findByIdAndUpdate(
      id,
      { $set: { name, phone, email } },
      { new: true, select: '_id name phone email' },
    ).lean()
    if (!updated) throw new Error('not found')
    return NextResponse.json({ id: String(updated._id), name: updated.name, phone: updated.phone, email: updated.email })
  } catch {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
}
