'use client'

import { useState, useEffect, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const STORAGE_KEY = 'dashboard_username'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [mounted, setMounted]   = useState(false)

  const fromParam      = searchParams.get('from')
  const sessionExpired = Boolean(fromParam && fromParam.startsWith('/dashboard'))

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) setUsername(saved)
    requestAnimationFrame(() => setMounted(true))
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res  = await fetch('/api/dashboard/auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Invalid credentials')
        setShakeKey(k => k + 1)
        return
      }
      localStorage.setItem(STORAGE_KEY, username.trim())
      setSuccess(true)
      setTimeout(() => router.push(fromParam ?? '/dashboard'), 600)
    } catch {
      setError('Request failed. Please try again.')
      setShakeKey(k => k + 1)
    } finally {
      setLoading(false)
    }
  }

  const frozen = loading || success

  return (
    <main
      className="login-dashboard min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--login-bg)' }}
    >
      <section
        key={shakeKey}
        style={{
          opacity:    mounted ? 1 : 0,
          transform:  mounted ? 'translateY(0)' : 'translateY(16px)',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          background: 'var(--login-card-bg)',
          borderColor: error ? 'var(--login-card-err)' : 'var(--login-card-border)',
        }}
        className={`w-full max-w-md rounded-2xl border p-7 shadow-2xl ${error ? 'login-shake' : ''}`}
      >
        <p
          className="text-xs font-black uppercase tracking-[0.22em] text-center"
          style={{ color: 'var(--login-kicker)' }}
        >
          Management Access
        </p>
        <h1 className="mt-3 text-2xl font-black text-white text-center">Dashboard Login</h1>
        <p className="mt-2 text-sm font-semibold text-center">
          {sessionExpired
            ? <span className="text-amber-400">Your session has expired — please sign in again.</span>
            : <span className="text-slate-400">Admins see all shops. Managers see only their assigned shop.</span>
          }
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <input
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(null) }}
            placeholder="Username"
            autoComplete="username"
            autoFocus
            style={{
              borderColor: error ? 'var(--login-field-err)' : 'var(--login-field-border)',
            }}
            className="w-full rounded-xl border bg-slate-950 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors"
            onFocus={e => e.currentTarget.style.borderColor = error ? 'var(--login-field-err-f)' : 'var(--login-accent-focus)'}
            onBlur={e  => e.currentTarget.style.borderColor = error ? 'var(--login-field-err)'   : 'var(--login-field-border)'}
            disabled={frozen}
          />

          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              onBlur={(e) => {
                setCapsLock(false)
                e.currentTarget.style.borderColor = error ? 'var(--login-field-err)' : 'var(--login-field-border)'
              }}
              onFocus={e => e.currentTarget.style.borderColor = error ? 'var(--login-field-err-f)' : 'var(--login-accent-focus)'}
              placeholder="Password"
              autoComplete="current-password"
              style={{
                borderColor: error ? 'var(--login-field-err)' : 'var(--login-field-border)',
              }}
              className="w-full rounded-xl border bg-slate-950 px-4 py-3 pr-11 text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors"
              disabled={frozen}
            />
            <button
              type="button"
              onClick={() => setShowPwd(v => !v)}
              tabIndex={-1}
              aria-label={showPwd ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
            >
              {showPwd ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {capsLock && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Caps Lock is on
            </p>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-red-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={frozen || !username.trim() || !password.trim()}
            style={success
              ? undefined
              : { background: 'var(--login-accent-btn)' }
            }
            onMouseEnter={e => { if (!success && !frozen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--login-accent-btn-h)' }}
            onMouseLeave={e => { if (!success && !frozen) (e.currentTarget as HTMLButtonElement).style.background = 'var(--login-accent-btn)' }}
            className={`w-full rounded-xl py-3 text-sm font-black text-white transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-45 ${
              success ? 'bg-emerald-600' : ''
            }`}
          >
            {success ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Access granted
              </>
            ) : (
              <>
                {loading && (
                  <svg className="animate-spin h-4 w-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? 'Signing in...' : 'Open Dashboard'}
              </>
            )}
          </button>
        </form>

        <p className="mt-5 text-center text-xs font-semibold text-slate-400">
          Shop voice station?{' '}
          <Link
            href="/agent-login"
            className="font-black underline underline-offset-4"
            style={{ color: 'var(--login-link)' }}
          >
            Open Agent Login
          </Link>
        </p>
      </section>
    </main>
  )
}

export default function DashboardLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950" />}>
      <LoginForm />
    </Suspense>
  )
}
