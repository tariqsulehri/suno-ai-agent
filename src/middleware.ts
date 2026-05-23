import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken, AUTH_COOKIE } from '@/lib/auth/session'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/dashboard/login' || pathname === '/agent-login') {
    return NextResponse.next()
  }

  const session = await verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value)

  if (pathname.startsWith('/dashboard')) {
    if (session?.role === 'admin' || session?.role === 'manager') return NextResponse.next()
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/dashboard/login'
    loginUrl.search = `?from=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === '/voice') {
    if (session?.role === 'agent' && session.shopId) return NextResponse.next()
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/agent-login'
    loginUrl.search = `?from=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/voice'],
}
