import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { verifyPassword } from '@/lib/auth/password'
import { AUTH_COOKIE, AUTH_MAX_AGE_SECS, createSessionToken } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { username?: string; password?: string }
  const username = body.username?.trim().toLowerCase()
  const password = body.password ?? ''

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { username }, include: { shop: true } })
  if (!user || !user.active || (user.role !== 'admin' && user.role !== 'manager')) {
    return NextResponse.json({ error: 'Invalid dashboard credentials' }, { status: 401 })
  }
  if (!await verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid dashboard credentials' }, { status: 401 })
  }
  if (user.role === 'manager' && !user.shopId) {
    return NextResponse.json({ error: 'Manager is not assigned to a shop' }, { status: 403 })
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
    role: user.role as 'admin' | 'manager',
    shopId: user.shopId,
    tenantId: user.tenantId,
  })

  const res = NextResponse.json({
    ok: true,
    role: user.role,
    shop: user.shop ? { id: user.shop.id, name: user.shop.name } : null,
  })
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
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
