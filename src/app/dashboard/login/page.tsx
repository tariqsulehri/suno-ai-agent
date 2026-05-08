'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

// ── Lock icon SVG ─────────────────────────────────────────────────────────────
function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-10 h-10 text-[#6c8ef7]"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ── Inner form — uses useSearchParams so it must be wrapped in Suspense ───────
function LoginForm() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!password.trim()) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/dashboard/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }

      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Incorrect password')
        return
      }

      // Redirect to the original destination or the main dashboard
      router.push(searchParams.get('from') ?? '/dashboard')
    } catch {
      setError('Request failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="bg-[#1a1f2e] rounded-2xl p-8 w-full max-w-sm shadow-xl">
        {/* Lock icon */}
        <div className="flex justify-center mb-6">
          <LockIcon />
        </div>

        {/* Title */}
        <h1 className="text-xl font-bold text-white text-center mb-6">
          Dashboard Login
        </h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            className="w-full bg-[#131720] border border-[#2d3748] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#6c8ef7] transition-colors"
            disabled={loading}
          />

          {/* Error message */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-2.5 bg-[#6c8ef7] hover:bg-[#5a7ef0] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Page — wraps form in Suspense for useSearchParams ─────────────────────────
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#6c8ef7] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
