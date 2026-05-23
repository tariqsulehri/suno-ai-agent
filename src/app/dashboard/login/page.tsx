'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!username.trim() || !password.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/dashboard/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Invalid credentials')
        return
      }
      router.push(searchParams.get('from') ?? '/dashboard')
    } catch {
      setError('Request failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#0f172a,#111827_48%,#172033)] flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/88 p-7 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-300 text-center">Management Access</p>
        <h1 className="mt-3 text-2xl font-black text-white text-center">Dashboard Login</h1>
        <p className="mt-2 text-sm font-semibold text-slate-400 text-center">
          Admins see all shops. Managers see only their assigned shop.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors focus:border-blue-400"
            disabled={loading}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors focus:border-blue-400"
            disabled={loading}
          />
          {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-45"
          >
            {loading ? 'Signing in...' : 'Open Dashboard'}
          </button>
        </form>
        <p className="mt-5 text-center text-xs font-semibold text-slate-400">
          Shop voice station?{' '}
          <Link href="/agent-login" className="font-black text-blue-200 underline underline-offset-4">
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
