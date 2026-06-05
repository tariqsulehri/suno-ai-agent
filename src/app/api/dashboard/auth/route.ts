import { NextRequest, NextResponse } from 'next/server'
import { connectDB, User, Shop } from '@/lib/db/client'
import { verifyPassword } from '@/lib/auth/password'
import { AUTH_COOKIE, AUTH_MAX_AGE_SECS, createSessionToken } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { username?: string; password?: string }
  const username = body.username?.trim().toLowerCase()
  const password = body.password ?? ''

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  await connectDB()
  const user = await User.findOne({ username }).lean()
  if (!user || !user.active || (user.role !== 'admin' && user.role !== 'manager')) {
    return NextResponse.json({ error: 'Invalid dashboard credentials' }, { status: 401 })
  }
  if (!await verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: 'Invalid dashboard credentials' }, { status: 401 })
  }
  if (user.role === 'manager' && !user.shopId) {
    return NextResponse.json({ error: 'Manager is not assigned to a shop' }, { status: 403 })
  }

  const shop = user.shopId ? await Shop.findById(user.shopId).lean() : null
  const userId = String(user._id)

  const token = await createSessionToken({
    userId,
    username: user.username,
    role: user.role as 'admin' | 'manager',
    shopId: user.shopId ?? null,
    tenantId: user.tenantId ?? null,
  })

  const res = NextResponse.json({
    ok: true,
    role: user.role,
    shop: shop ? { id: String(shop._id), name: shop.name } : null,
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
