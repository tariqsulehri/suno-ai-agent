'use client'

import { useState, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import type { DashboardData } from '@/lib/db/dashboard-query'

// ── Emoji maps ─────────────────────────────────────────────────────────────────
const SENTIMENT_EMOJI: Record<string, string> = {
  positive:   '✅',
  negative:   '⚠️',
  complaint:  '🚨',
  suggestion: '💡',
}
const SENTIMENT_LABEL: Record<string, string> = {
  positive:   'Positive',
  negative:   'Negative',
  complaint:  'Complaint',
  suggestion: 'Suggestion',
}
const SENTIMENT_COLOR: Record<string, string> = {
  positive:   '#22c55e',
  negative:   '#f97316',
  complaint:  '#ef4444',
  suggestion: '#6366f1',
}
const CATEGORY_EMOJI: Record<string, string> = {
  product:   '🍽️',
  service:   '⚡',
  behavioral:'👤',
  facility:  '🏢',
  pricing:   '💰',
  general:   '⭐',
}
const RATING_EMOJI: Record<number, string> = {
  5: '🌟', 4: '✨', 3: '😐', 2: '😞', 1: '😡',
}
const PRIORITY_EMOJI: Record<string, string> = {
  complaint:  '🔴',
  negative:   '🟡',
  suggestion: '💡',
}

// ── Search types ───────────────────────────────────────────────────────────────
interface SearchSource {
  id: string; shop: string; sentiment: string | null; category: string | null
  subcategory: string | null; rating: number | null; summary: string | null
  keyPoints: string[]; customer: { name: string | null; phone: string | null } | null
  createdAt: string
}
interface SearchResult { answer: string; sources: SearchSource[] }

// ── Palette ────────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#22c55e', '#f97316', '#ef4444', '#6366f1']

// ── Shared UI primitives ───────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#1a1f2e] rounded-2xl p-5 ${className}`}>{children}</div>
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{children}</h2>
}
function Divider() {
  return <div className="border-t border-[#2d3748] my-6" />
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  emoji, label, value, sub, color = '#6c8ef7', highlight = false,
}: {
  emoji: string; label: string; value: string | number
  sub?: string; color?: string; highlight?: boolean
}) {
  return (
    <div className={`bg-[#1a1f2e] rounded-2xl p-5 flex flex-col gap-1 border ${highlight ? 'border-[#6c8ef7]/40' : 'border-transparent'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{emoji}</span>
        <span className="text-xs text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-3xl font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-xs text-slate-500 mt-1">{sub}</span>}
    </div>
  )
}

// ── Sentiment Row ──────────────────────────────────────────────────────────────
function SentimentRow({ sentiment, count, total }: { sentiment: string; count: number; total: number }) {
  const pct   = total ? Math.round((count / total) * 100) : 0
  const color = SENTIMENT_COLOR[sentiment] ?? '#6c8ef7'
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-lg w-6">{SENTIMENT_EMOJI[sentiment]}</span>
      <span className="text-sm text-slate-300 w-24">{SENTIMENT_LABEL[sentiment]}</span>
      <div className="flex-1 bg-[#131720] rounded-full h-3">
        <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-bold w-8 text-right" style={{ color }}>{count}</span>
      <span className="text-xs text-slate-500 w-10 text-right">{pct}%</span>
    </div>
  )
}

// ── Category Row ───────────────────────────────────────────────────────────────
function CategoryRow({ name, data, maxTotal }: {
  name: string
  data: { positive: number; negative: number; complaint: number; suggestion: number; total: number }
  maxTotal: number
}) {
  const pctPos  = maxTotal ? (data.positive   / maxTotal) * 100 : 0
  const pctNeg  = maxTotal ? (data.negative   / maxTotal) * 100 : 0
  const pctComp = maxTotal ? (data.complaint  / maxTotal) * 100 : 0
  const pctSugg = maxTotal ? (data.suggestion / maxTotal) * 100 : 0

  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#1e2535] last:border-0">
      <span className="text-lg w-6">{CATEGORY_EMOJI[name] ?? '📌'}</span>
      <span className="text-sm text-slate-300 w-24 capitalize">{name}</span>
      <div className="flex-1 flex gap-0.5 h-5 rounded-lg overflow-hidden bg-[#131720]">
        {data.positive   > 0 && <div style={{ width: `${pctPos}%`,  background: '#22c55e' }} title={`✅ ${data.positive}`} />}
        {data.negative   > 0 && <div style={{ width: `${pctNeg}%`,  background: '#f97316' }} title={`⚠️ ${data.negative}`} />}
        {data.complaint  > 0 && <div style={{ width: `${pctComp}%`, background: '#ef4444' }} title={`🚨 ${data.complaint}`} />}
        {data.suggestion > 0 && <div style={{ width: `${pctSugg}%`, background: '#6366f1' }} title={`💡 ${data.suggestion}`} />}
      </div>
      <div className="flex gap-2 text-xs flex-wrap">
        <span className="text-[#22c55e]">✅ {data.positive}</span>
        <span className="text-[#f97316]">⚠️ {data.negative}</span>
        <span className="text-[#ef4444]">🚨 {data.complaint}</span>
        {data.suggestion > 0 && <span className="text-[#6366f1]">💡 {data.suggestion}</span>}
      </div>
    </div>
  )
}

// ── Rating Bar ─────────────────────────────────────────────────────────────────
function RatingBar({ rating, count, max }: { rating: number; count: number; max: number }) {
  const pct = max ? Math.round((count / max) * 100) : 0
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-base w-6">{RATING_EMOJI[rating]}</span>
      <span className="text-xs text-slate-400 w-4">{rating}★</span>
      <div className="flex-1 bg-[#131720] rounded-full h-2.5">
        <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: colors[rating] }} />
      </div>
      <span className="text-xs font-semibold text-slate-300 w-6 text-right">{count}</span>
    </div>
  )
}

// ── Shop Performance Card ──────────────────────────────────────────────────────
function ShopCard({ shop, rank }: {
  shop: DashboardData['shops'][0]; rank: number
}) {
  const scoreColor = !shop.satisfaction ? '#94a3b8'
    : shop.satisfaction >= 70 ? '#22c55e'
    : shop.satisfaction >= 45 ? '#eab308'
    : '#ef4444'

  const scoreEmoji = !shop.satisfaction ? '—'
    : shop.satisfaction >= 70 ? '😊'
    : shop.satisfaction >= 45 ? '😐'
    : '😟'

  return (
    <div className="bg-[#131720] rounded-2xl p-5 border border-[#2d3748]">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold">#{rank}</span>
            <span className="text-sm font-bold text-slate-200">🏪 {shop.name}</span>
          </div>
          {shop.city && <p className="text-xs text-slate-500 mt-0.5">📍 {shop.city}</p>}
        </div>
        <div className="text-right">
          <div className="text-2xl font-black" style={{ color: scoreColor }}>
            {shop.satisfaction !== null ? `${shop.satisfaction}%` : '—'}
          </div>
          <div className="text-lg">{scoreEmoji}</div>
          <div className="text-xs text-slate-500">Satisfaction</div>
        </div>
      </div>

      {/* Sentiment split */}
      <div className="flex gap-2 mb-4">
        {[
          { emoji: '✅', label: 'Positive',   count: shop.positive,   color: '#22c55e' },
          { emoji: '⚠️', label: 'Negative',   count: shop.negative,   color: '#f97316' },
          { emoji: '🚨', label: 'Complaint',  count: shop.complaint,  color: '#ef4444' },
          { emoji: '💡', label: 'Suggestion', count: shop.suggestion, color: '#6366f1' },
        ].map((s) => (
          <div key={s.label} className="flex-1 bg-[#1a1f2e] rounded-xl p-2 text-center">
            <div className="text-base">{s.emoji}</div>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-xs text-slate-600">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Avg rating */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-slate-400">⭐ Avg Rating</span>
        <span className="font-bold text-yellow-400">
          {shop.avgRating !== null ? `${shop.avgRating} / 5` : '—'}
        </span>
      </div>

      {/* Category breakdown */}
      <div className="space-y-1.5">
        {Object.entries(shop.categoryBreakdown)
          .sort((a, b) => b[1].total - a[1].total)
          .map(([cat, d]) => (
            <div key={cat} className="flex items-center gap-2 text-xs">
              <span>{CATEGORY_EMOJI[cat] ?? '📌'}</span>
              <span className="text-slate-400 capitalize w-20">{cat}</span>
              <div className="flex-1 bg-[#0f1117] rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${(d.total / shop.total) * 100}%`,
                    background: d.complaint > 0 ? '#ef4444' : d.negative > 0 ? '#f97316' : '#22c55e',
                  }}
                />
              </div>
              <span className="text-slate-500 w-4 text-right">{d.total}</span>
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Recent Review Feed ─────────────────────────────────────────────────────────
function ReviewFeed({ reviews }: { reviews: DashboardData['recentReviews'] }) {
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="flex gap-3 p-3 bg-[#131720] rounded-xl border border-[#2d3748]">
          <span className="text-xl mt-0.5 shrink-0">
            {SENTIMENT_EMOJI[r.sentiment ?? ''] ?? '💬'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-300">🏪 {r.shopName}</span>
                {r.category && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1a1f2e] text-slate-400 capitalize">
                    {CATEGORY_EMOJI[r.category]} {r.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {r.rating && <span className="text-xs text-yellow-400">{RATING_EMOJI[r.rating]} {r.rating}★</span>}
                <span className="text-xs text-slate-600">
                  {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{r.summary}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── AI Search Panel ────────────────────────────────────────────────────────────
const EXAMPLE_QUERIES = [
  '🔍 Which outlet has the most hygiene complaints?',
  '👤 What are customers saying about staff behaviour?',
  '🍽️ Show me all negative product reviews',
  '😊 Which shop has the highest satisfaction?',
]

function SearchPanel() {
  const [query, setQuery]   = useState('')
  const [loading, setLoad]  = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function search(q: string) {
    const clean = q.replace(/^[^\w]+ ?/, '')
    if (!clean.trim()) return
    setQuery(clean)
    setLoad(true); setResult(null); setError(null)
    try {
      const res  = await fetch('/api/dashboard/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: clean, limit: 6 }),
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResult(data as SearchResult)
    } catch { setError('Search failed. Please try again.') }
    finally { setLoad(false) }
  }

  return (
    <Card className="mb-6">
      <SectionTitle>🤖 AI-Powered Review Search</SectionTitle>
      <p className="text-xs text-slate-500 mb-4">Ask any question about your reviews in plain English</p>
      <div className="flex gap-2 mb-4">
        <input
          ref={inputRef}
          type="text" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(query)}
          placeholder="e.g. Which outlet has the most behavioral complaints?"
          className="flex-1 bg-[#131720] border border-[#2d3748] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#6c8ef7] transition-colors"
        />
        <button
          onClick={() => search(query)} disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-[#6c8ef7] hover:bg-[#5a7ef0] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? '...' : '🔍 Ask'}
        </button>
      </div>
      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button key={q} onClick={() => search(q)}
              className="text-xs px-3 py-1.5 bg-[#131720] hover:bg-[#1e2535] text-slate-400 hover:text-slate-200 rounded-full border border-[#2d3748] transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-3 py-6 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-[#6c8ef7] border-t-transparent rounded-full animate-spin" />
          Analysing reviews…
        </div>
      )}
      {error && <p className="text-sm text-red-400 mt-2">❌ {error}</p>}
      {result && (
        <div className="mt-4">
          <div className="bg-[#131720] rounded-xl p-4 mb-4 border-l-4 border-[#6c8ef7]">
            <p className="text-xs text-[#6c8ef7] font-bold mb-2 uppercase tracking-widest">🤖 AI Analysis</p>
            <p className="text-slate-200 text-sm leading-relaxed">{result.answer}</p>
          </div>
          {result.sources.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-widest">
                📋 Based on {result.sources.length} matching review{result.sources.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.sources.map((s) => (
                  <div key={s.id} className="bg-[#131720] rounded-xl p-3 border border-[#2d3748]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-300">🏪 {s.shop}</span>
                      <span className="text-sm">{SENTIMENT_EMOJI[s.sentiment ?? ''] ?? '💬'}</span>
                    </div>
                    {s.category && (
                      <p className="text-xs text-slate-500 mb-1 capitalize">
                        {CATEGORY_EMOJI[s.category]} {s.category}{s.subcategory ? ` · ${s.subcategory}` : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{s.summary}</p>
                    {s.rating && (
                      <div className="mt-1.5 text-xs text-yellow-400">{RATING_EMOJI[s.rating]} {s.rating}★</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <button onClick={() => { setResult(null); setQuery(''); inputRef.current?.focus() }}
            className="mt-4 text-xs text-slate-500 hover:text-slate-300 underline">
            ✕ Clear search
          </button>
        </div>
      )}
    </Card>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="min-h-dvh bg-[#0f1117] flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-4">📊</div>
        <p className="text-xl font-bold text-slate-300">No reviews yet</p>
        <p className="text-sm text-slate-500 mt-2">Reviews will appear once customers start leaving feedback.</p>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export function DashboardClient({ data }: { data: DashboardData | null }) {
  if (!data) return <EmptyState />

  const { totalReviews, avgRating, bysentiment, categorySentiment, trend, ratingDist, topIssues, topSuggestions, recentReviews, shops } = data

  const positive   = bysentiment['positive']   ?? 0
  const negative   = bysentiment['negative']   ?? 0
  const complaint  = bysentiment['complaint']  ?? 0
  const suggestion = bysentiment['suggestion'] ?? 0
  const satisfaction = avgRating ? Math.round((avgRating / 5) * 100) : null

  const sentimentPie = [
    { name: '✅ Positive',   value: positive,   color: '#22c55e' },
    { name: '⚠️ Negative',   value: negative,   color: '#f97316' },
    { name: '🚨 Complaint',  value: complaint,  color: '#ef4444' },
    { name: '💡 Suggestion', value: suggestion, color: '#6366f1' },
  ].filter((s) => s.value > 0)

  const trendData    = trend.map((t) => ({ month: t.month.slice(5), count: Number(t.count) }))
  const maxRating    = Math.max(...ratingDist.map((r) => r.count), 1)
  const rankedShops  = [...shops].sort((a, b) => (b.satisfaction ?? 0) - (a.satisfaction ?? 0))
  const maxCatTotal  = Math.max(...Object.values(categorySentiment).map((c) => c.total), 1)

  const satisfactionEmoji = !satisfaction ? '—'
    : satisfaction >= 70 ? '😊' : satisfaction >= 45 ? '😐' : '😟'
  const satisfactionColor = !satisfaction ? '#94a3b8'
    : satisfaction >= 70 ? '#22c55e' : satisfaction >= 45 ? '#eab308' : '#ef4444'

  return (
    <div className="min-h-dvh bg-[#0f1117] text-white p-6 font-sans">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">📊 Customer Review Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Management Dashboard · Real-time outlet performance</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p>🗓️ Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="mt-1">🗄️ Powered by SQLite · sqlite-vec</p>
        </div>
      </div>

      {/* ── AI Search ─────────────────────────────────────────────────────── */}
      <SearchPanel />

      {/* ── Executive KPIs ────────────────────────────────────────────────── */}
      <SectionTitle>Executive Summary</SectionTitle>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        <KpiCard emoji="📊" label="Total"       value={totalReviews} color="#6c8ef7" highlight />
        <KpiCard emoji="✅" label="Positive"     value={positive}
          sub={`${totalReviews ? Math.round(positive / totalReviews * 100) : 0}%`}
          color="#22c55e" />
        <KpiCard emoji="⚠️" label="Negative"    value={negative}
          sub={`${totalReviews ? Math.round(negative / totalReviews * 100) : 0}%`}
          color="#f97316" />
        <KpiCard emoji="🚨" label="Complaints"  value={complaint}
          sub={`${totalReviews ? Math.round(complaint / totalReviews * 100) : 0}%`}
          color="#ef4444" />
        <KpiCard emoji="💡" label="Suggestions" value={suggestion}
          sub={`${totalReviews ? Math.round(suggestion / totalReviews * 100) : 0}%`}
          color="#6366f1" />
        <KpiCard emoji="⭐" label="Avg Rating"
          value={avgRating !== null ? `${avgRating}/5` : '—'}
          color="#eab308" />
        <KpiCard emoji={satisfactionEmoji} label="Satisfaction"
          value={satisfaction !== null ? `${satisfaction}%` : '—'}
          color={satisfactionColor} />
      </div>

      <Divider />

      {/* ── Sentiment + Category ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">

        {/* Sentiment Analysis */}
        <Card>
          <SectionTitle>😊 Sentiment Breakdown</SectionTitle>
          <div className="flex gap-4 items-center">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                  {sentimentPie.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1f2e', border: 'none', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1">
              {['positive', 'negative', 'complaint', 'suggestion'].map((s) => (
                <SentimentRow key={s} sentiment={s} count={bysentiment[s] ?? 0} total={totalReviews} />
              ))}
            </div>
          </div>
        </Card>

        {/* Category Analysis */}
        <Card>
          <SectionTitle>📂 Category Breakdown (Positive vs Negative)</SectionTitle>
          <div>
            {Object.entries(categorySentiment)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([cat, d]) => (
                <CategoryRow key={cat} name={cat} data={d} maxTotal={maxCatTotal} />
              ))}
          </div>
          <div className="flex gap-3 mt-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#22c55e] inline-block"/>Positive</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#f97316] inline-block"/>Negative</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#ef4444] inline-block"/>Complaint</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-[#6366f1] inline-block"/>Suggestion</span>
          </div>
        </Card>
      </div>

      {/* ── Shop Performance ──────────────────────────────────────────────── */}
      <SectionTitle>🏪 Outlet Performance</SectionTitle>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
        {rankedShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} rank={i + 1} />)}
      </div>

      <Divider />

      {/* ── Top Issues + Top Suggestions ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">

        {/* Top Issues */}
        <Card>
          <SectionTitle>🔴 Top Issues Requiring Attention</SectionTitle>
          {topIssues.length === 0
            ? <p className="text-slate-500 text-sm">No critical issues found 🎉</p>
            : (
              <div className="space-y-2">
                {topIssues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-[#131720] rounded-xl">
                    <span className="text-base">{PRIORITY_EMOJI[issue.sentiment] ?? '🟢'}</span>
                    <span className="text-base">{CATEGORY_EMOJI[issue.category] ?? '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 capitalize truncate">{issue.subcategory}</p>
                      <p className="text-xs text-slate-500 capitalize">{issue.category}</p>
                    </div>
                    <span className="text-sm font-bold shrink-0"
                          style={{ color: issue.sentiment === 'complaint' ? '#ef4444' : '#f97316' }}>
                      {issue.count}×
                    </span>
                  </div>
                ))}
              </div>
            )}
        </Card>

        {/* Top Suggestions */}
        <Card>
          <SectionTitle>💡 Top Customer Suggestions</SectionTitle>
          {topSuggestions.length === 0
            ? <p className="text-slate-500 text-sm">No suggestions recorded yet</p>
            : (
              <div className="space-y-2">
                {topSuggestions.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-[#131720] rounded-xl">
                    <span className="text-base">💡</span>
                    <span className="text-base">{CATEGORY_EMOJI[s.category] ?? '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 capitalize truncate">{s.subcategory}</p>
                      <p className="text-xs text-slate-500 capitalize">{s.category}</p>
                    </div>
                    <span className="text-sm font-bold text-[#6366f1] shrink-0">{s.count}×</span>
                  </div>
                ))}
              </div>
            )}
        </Card>
      </div>

      {/* ── Trend + Rating Distribution ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">

        {/* Monthly Trend */}
        <Card>
          <SectionTitle>📈 Monthly Review Trend</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#1a1f2e', border: 'none', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0' }} />
              <Line type="monotone" dataKey="count" stroke="#6c8ef7" strokeWidth={2.5}
                dot={{ fill: '#6c8ef7', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <SectionTitle>⭐ Rating Distribution</SectionTitle>
          {ratingDist.length === 0
            ? <p className="text-slate-500 text-sm">No ratings collected yet</p>
            : (
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const found = ratingDist.find((r) => r.rating === star)
                  return <RatingBar key={star} rating={star} count={found?.count ?? 0} max={maxRating} />
                })}
              </div>
            )}
          {avgRating !== null && (
            <div className="mt-4 pt-3 border-t border-[#2d3748] flex items-center justify-between">
              <span className="text-sm text-slate-400">Overall Average</span>
              <span className="text-lg font-bold text-yellow-400">⭐ {avgRating} / 5</span>
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent Reviews (full width) ─────────────────────────────────────── */}
      <Card className="mb-8">
        <SectionTitle>🕐 Recent Reviews</SectionTitle>
        <ReviewFeed reviews={recentReviews} />
      </Card>

      <p className="text-center text-slate-700 text-xs mt-8">
        📊 VoiceAgent · Customer Review Analytics · © {new Date().getFullYear()}
      </p>
    </div>
  )
}
