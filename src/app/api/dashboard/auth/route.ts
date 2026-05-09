import { NextRequest, NextResponse } from 'next/server'

// Cookie settings
const COOKIE_NAME  = 'dashboard_auth'
const MAX_AGE_SECS = 60 * 60 * 24 * 7 // 7 days

// ── Shared hash helper ────────────────────────────────────────────────────────
async function hashToken(password: string): Promise<string> {
  const salt = process.env.SESSION_SALT ?? 'va-dashboard-2025'
  const enc  = new TextEncoder()
  const buf  = await crypto.subtle.digest('SHA-256', enc.encode(password + salt))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── POST — authenticate and set cookie ───────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json() as { password?: string }
  const { password } = body

  const envPassword = process.env.DASHBOARD_PASSWORD

  // No password configured — allow open access
  if (!envPassword) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(COOKIE_NAME, 'open', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: MAX_AGE_SECS,
    })
    return res
  }

  // Validate password
  if (!password || password !== envPassword) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  // Compute token hash and set cookie
  const token = await hashToken(password)
  const res   = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECS,
  })
  return res
}

// ── DELETE — logout and clear cookie ─────────────────────────────────────────
export async function DELETE(_req: NextRequest) {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
