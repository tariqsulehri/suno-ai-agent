import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

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
    const updated = await db.lead.update({
      where: { id },
      data:  { name, phone, email },
      select: { id: true, name: true, phone: true, email: true },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  }
}
