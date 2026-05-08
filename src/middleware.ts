import { NextRequest, NextResponse } from 'next/server'

// ── Hash helper — runs in Edge runtime via crypto.subtle ───────────────────────
async function hashToken(password: string): Promise<string> {
  const salt = process.env.SESSION_SALT ?? 'va-dashboard-2025'
  const enc  = new TextEncoder()
  const buf  = await crypto.subtle.digest('SHA-256', enc.encode(password + salt))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow the login page through without any auth check
  if (pathname === '/dashboard/login') {
    return NextResponse.next()
  }

  // If DASHBOARD_PASSWORD is not configured, allow everything through
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) {
    return NextResponse.next()
  }

  // Validate the dashboard_auth cookie
  const cookieValue = req.cookies.get('dashboard_auth')?.value
  if (cookieValue) {
    const expected = await hashToken(password)
    if (cookieValue === expected) {
      return NextResponse.next()
    }
  }

  // Not authenticated — redirect to login with the original path as `from`
  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/dashboard/login'
  loginUrl.search   = `?from=${encodeURIComponent(pathname)}`
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
