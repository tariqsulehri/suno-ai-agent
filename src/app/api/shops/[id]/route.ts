import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'

// ── PATCH /api/shops/[id] — update editable shop fields ──────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const body = await req.json() as {
      name?:      string
      city?:      string
      state?:     string
      town?:      string
      address?:   string
      phone?:     string
      mobile?:    string
      email?:     string
      lat?:       string | number | null
      lng?:       string | number | null
    }

    // Build update payload — only include fields that were provided
    const data: Record<string, string | number | null | undefined> = {}

    if (body.name    !== undefined) data.name    = body.name
    if (body.city    !== undefined) data.city    = body.city
    if (body.state   !== undefined) data.state   = body.state
    if (body.town    !== undefined) data.town    = body.town
    if (body.address !== undefined) data.address = body.address
    if (body.phone   !== undefined) data.phone   = body.phone
    if (body.mobile  !== undefined) data.mobile  = body.mobile
    if (body.email   !== undefined) data.email   = body.email

    // Parse lat/lng — empty string becomes null
    if (body.lat !== undefined) {
      data.lat = body.lat === '' || body.lat === null
        ? null
        : parseFloat(String(body.lat))
    }
    if (body.lng !== undefined) {
      data.lng = body.lng === '' || body.lng === null
        ? null
        : parseFloat(String(body.lng))
    }

    const updated = await db.shop.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (err) {
    console.error(`[PATCH /api/shops/${id}]`, err)
    return NextResponse.json({ error: 'Failed to update shop' }, { status: 500 })
  }
}
