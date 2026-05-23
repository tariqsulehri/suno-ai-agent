'use client'

import { useEffect, useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ShopOption {
  id: string
  name: string
  city: string | null
  branchCode: string | null
}

function AgentLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [shops, setShops] = useState<ShopOption[]>([])
  const [shopId, setShopId] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const selectedShop = shops.find((shop) => shop.id === shopId)
  const outletCode = selectedShop?.branchCode?.replace(/^shop/i, 'outlet')
  const agentHint = outletCode ? `agent-${outletCode}` : 'agent-outlet1'

  useEffect(() => {
    fetch('/api/shops')
      .then((res) => res.json())
      .then((data: ShopOption[]) => {
        setShops(data)
        setShopId((prev) => prev || data[0]?.id || '')
      })
      .catch(() => setError('Could not load shops. Please refresh.'))
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!shopId || !username.trim() || !password.trim()) return
    const normalizedUsername = username.trim().toLowerCase()

    if (normalizedUsername === 'admin' || normalizedUsername === 'manager' || normalizedUsername.startsWith('manager-')) {
      setError('This screen is for shop agent accounts only. Admins and managers should use Dashboard Login.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/agent-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, username: normalizedUsername, password }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Invalid agent credentials')
        return
      }
      router.push(searchParams.get('from') ?? '/voice')
    } catch {
      setError('Request failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(135deg,#06111f,#0f2636_48%,#081827)] flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-2xl border border-cyan-900/70 bg-slate-950/86 p-7 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300 text-center">Agent Session</p>
        <h1 className="mt-3 text-2xl font-black text-white text-center">Start Voice Agent</h1>
        <p className="mt-2 text-sm font-semibold text-slate-400 text-center">
          Select your shop and sign in with the agent account assigned to this location.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white outline-none transition-colors focus:border-cyan-400"
            disabled={loading || shops.length === 0}
          >
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}{shop.city ? ` - ${shop.city}` : ''}
              </option>
            ))}
          </select>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={`Agent username, e.g. ${agentHint}`}
            autoComplete="username"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-400"
            disabled={loading}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none transition-colors focus:border-cyan-400"
            disabled={loading}
          />
          <div className="rounded-xl border border-cyan-700/40 bg-cyan-400/8 px-4 py-3 text-sm font-semibold text-cyan-50">
            <p>Agent login only. Use the shop agent account for {selectedShop?.name ?? 'the selected shop'}.</p>
            <p className="mt-1 text-xs text-cyan-200/80">
              Expected username: <span className="font-black text-cyan-100">{agentHint}</span>
            </p>
            <p className="mt-1 text-xs text-cyan-200/80">
              Admin or manager?{' '}
              <Link href="/dashboard/login" className="font-black text-cyan-200 underline underline-offset-4">
                Open Dashboard Login
              </Link>
            </p>
          </div>
          {error && <p className="text-sm font-semibold text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading || !shopId || !username.trim() || !password.trim()}
            className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-black text-white transition-colors hover:bg-cyan-500 disabled:opacity-45"
          >
            {loading ? 'Starting session...' : 'Start Agent'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default function AgentLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-slate-950" />}>
      <AgentLoginForm />
    </Suspense>
  )
}
