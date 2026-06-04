import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { verifyPassword } from '@/lib/auth/password'
import { AUTH_COOKIE, AUTH_MAX_AGE_SECS, createSessionToken } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    username?: string
    password?: string
    shopId?: string
  }
  const username = body.username?.trim().toLowerCase()
  const password = body.password ?? ''
  const shopId = body.shopId?.trim()

  if (!username || !password || !shopId) {
    return NextResponse.json({ error: 'Shop, username, and password are required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { username }, include: { shop: true } })
  if (!user || !user.active || user.role !== 'agent' || user.shopId !== shopId) {
    return NextResponse.json({ error: 'Invalid agent credentials for this shop' }, { status: 401 })
  }
  if (!await verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid agent credentials for this shop' }, { status: 401 })
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: 'agent',
    shopId: user.shopId,
    tenantId: user.tenantId,
  })

  const res = NextResponse.json({
    ok: true,
    shop: user.shop ? { id: user.shop.id, name: user.shop.name, branchCode: user.shop.branchCode } : null,
  })
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',  // HTTPS-only on Vercel
    path:     '/',
    maxAge:   AUTH_MAX_AGE_SECS,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(AUTH_COOKIE)
  return res
}
