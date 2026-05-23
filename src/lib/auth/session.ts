import type { NextRequest } from 'next/server'

export const AUTH_COOKIE = 'app_session'
export const AUTH_MAX_AGE_SECS = 60 * 60 * 24 * 7

export type AppRole = 'agent' | 'manager' | 'admin'

export interface AppSession {
  userId: string
  username: string
  role: AppRole
  shopId: string | null
  tenantId: string | null
  exp: number
}

const enc = new TextEncoder()

function base64UrlEncode(input: string | ArrayBuffer): string {
  const raw = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)))
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  return atob(padded)
}

async function sign(message: string): Promise<string> {
  const secret = process.env.SESSION_SECRET ?? process.env.SESSION_SALT ?? 'va-dashboard-2025'
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

export async function createSessionToken(
  payload: Omit<AppSession, 'exp'>,
  maxAgeSecs = AUTH_MAX_AGE_SECS
): Promise<string> {
  const body = base64UrlEncode(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + maxAgeSecs,
  } satisfies AppSession))
  return `${body}.${await sign(body)}`
}

export async function verifySessionToken(token: string | undefined | null): Promise<AppSession | null> {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  if (await sign(body) !== signature) return null

  try {
    const session = JSON.parse(base64UrlDecode(body)) as AppSession
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null
    if (session.role !== 'agent' && session.role !== 'manager' && session.role !== 'admin') return null
    return session
  } catch {
    return null
  }
}

export async function getSessionFromRequest(req: NextRequest): Promise<AppSession | null> {
  return verifySessionToken(req.cookies.get(AUTH_COOKIE)?.value)
}
