'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line, CartesianGrid,
} from 'recharts'
import type { DashboardData } from '@/lib/db/dashboard-query'
import { PROVINCES, CITIES_BY_PROVINCE } from '@/data/pakistan-locations'

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
const CHART_GRID = '#d8e0ea'
const CHART_TICK = '#64748b'
const DASHBOARD_ACCENT = '#2563eb'
const DASHBOARD_ACCENT_DARK = '#1d4ed8'

const surfaceCls = 'bg-white border border-slate-200 shadow-[0_18px_45px_rgba(15,23,42,0.08)]'
const insetCls = 'bg-slate-50 border border-slate-200'
const inputCls = 'w-full bg-white border border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-colors'
const secondaryBtnCls = 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300'

// ── Shared UI primitives ───────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${surfaceCls} rounded-xl p-5 lg:p-6 ${className}`}>{children}</div>
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{children}</h2>
}
function Divider() {
  return <div className="border-t border-slate-200 my-8" />
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  emoji, label, value, sub, color = '#6c8ef7', highlight = false,
}: {
  emoji: string; label: string; value: string | number
  sub?: string; color?: string; highlight?: boolean
}) {
  return (
    <div className={`${surfaceCls} rounded-xl p-5 flex flex-col gap-1 border ${highlight ? 'border-blue-300 ring-4 ring-blue-50' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{emoji}</span>
        <span className="text-xs text-slate-500 uppercase tracking-widest">{label}</span>
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
      <span className="text-sm text-slate-700 w-24">{SENTIMENT_LABEL[sentiment]}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-3">
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
    <div className="grid grid-cols-[auto_minmax(5rem,8rem)_1fr] sm:grid-cols-[auto_8rem_1fr_auto] items-center gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-lg w-6">{CATEGORY_EMOJI[name] ?? '📌'}</span>
      <span className="text-sm text-slate-700 capitalize min-w-0 break-words">{name}</span>
      <div className="flex min-w-0 gap-0.5 h-5 rounded-lg overflow-hidden bg-slate-100">
        {data.positive   > 0 && <div style={{ width: `${pctPos}%`,  background: '#22c55e' }} title={`✅ ${data.positive}`} />}
        {data.negative   > 0 && <div style={{ width: `${pctNeg}%`,  background: '#f97316' }} title={`⚠️ ${data.negative}`} />}
        {data.complaint  > 0 && <div style={{ width: `${pctComp}%`, background: '#ef4444' }} title={`🚨 ${data.complaint}`} />}
        {data.suggestion > 0 && <div style={{ width: `${pctSugg}%`, background: '#6366f1' }} title={`💡 ${data.suggestion}`} />}
      </div>
      <div className="col-span-3 sm:col-span-1 flex gap-2 text-xs flex-wrap justify-start sm:justify-end">
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
      <span className="text-xs text-slate-500 w-4">{rating}★</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5">
        <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: colors[rating] }} />
      </div>
      <span className="text-xs font-semibold text-slate-700 w-6 text-right">{count}</span>
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
    <div className={`${surfaceCls} rounded-xl p-5`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-slate-500 font-bold">#{rank}</span>
            <span className="text-sm font-bold text-slate-900 break-words">🏪 {shop.name}</span>
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
          <div key={s.label} className="flex-1 bg-slate-50 rounded-lg p-2 text-center border border-slate-100 min-w-0">
            <div className="text-base">{s.emoji}</div>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.count}</div>
            <div className="text-xs text-slate-500 truncate">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Avg rating */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-slate-500">⭐ Avg Rating</span>
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
              <span className="text-slate-600 capitalize w-20 min-w-0 break-words">{cat}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-1.5">
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

// ── Status badge + cycle button ────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; next: string; nextLabel: string }> = {
  pending:   { label: 'Pending',   color: '#f97316', next: 'contacted', nextLabel: 'Mark Contacted' },
  contacted: { label: 'Contacted', color: '#2563eb', next: 'resolved',  nextLabel: 'Mark Resolved'  },
  resolved:  { label: 'Resolved',  color: '#22c55e', next: 'pending',   nextLabel: 'Reopen'         },
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META['pending']
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
          style={{ background: meta.color }}>
      {meta.label}
    </span>
  )
}

// ── Numeric phone pad ──────────────────────────────────────────────────────────
const PAD_KEYS = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['+','0','⌫'],
]

function PhonePad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function press(k: string) {
    if (k === '⌫') { onChange(value.slice(0, -1)); return }
    if (value.length >= 16) return
    onChange(value + k)
  }
  return (
    <div className="select-none">
      {/* Display */}
      <div className="flex items-center gap-2 bg-slate-900 rounded-xl px-4 py-3 mb-3">
        <span className="text-slate-400 text-sm">📞</span>
        <span className="flex-1 text-white font-mono text-lg tracking-widest min-h-[1.5rem]">
          {value || <span className="text-slate-500 text-sm font-sans">Enter number…</span>}
        </span>
        {value && (
          <button onClick={() => onChange('')}
            className="text-slate-500 hover:text-red-400 text-xs px-2 py-0.5 rounded transition-colors">
            Clear
          </button>
        )}
      </div>
      {/* Keys */}
      <div className="grid grid-cols-3 gap-2">
        {PAD_KEYS.flat().map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className={`py-3 rounded-xl text-base font-semibold transition-colors ${
              k === '⌫'
                ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-200'
                : 'bg-white border border-slate-200 text-slate-800 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 active:scale-95'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Edit Contact Panel ─────────────────────────────────────────────────────────
function EditContactPanel({
  review,
  onSaved,
  onCancel,
}: {
  review: ReviewRow
  onSaved: (lead: { name: string | null; phone: string | null; email: string | null }) => void
  onCancel: () => void
}) {
  const [name,   setName]   = useState(review.leadName  ?? '')
  const [phone,  setPhone]  = useState(review.leadPhone ?? '')
  const [email,  setEmail]  = useState(review.leadEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState<string | null>(null)
  const [ok,     setOk]     = useState(false)

  async function save() {
    if (!review.leadId) { setErr('No contact record to update'); return }
    setSaving(true); setErr(null)
    try {
      const res = await fetch(`/api/leads/${review.leadId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, phone, email }),
      })
      if (!res.ok) { setErr('Save failed'); return }
      const data = await res.json()
      setOk(true)
      setTimeout(() => onSaved({ name: data.name, phone: data.phone, email: data.email }), 600)
    } catch { setErr('Network error') }
    finally { setSaving(false) }
  }

  const fieldCls = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-500 transition-colors'

  return (
    <div className="space-y-4">
      {ok && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm text-center px-4 py-2 rounded-xl">
          Saved!
        </div>
      )}
      {err && <p className="text-red-500 text-sm">{err}</p>}

      <div>
        <label className="block text-xs text-slate-500 mb-1 font-semibold">👤 Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name"
          className={fieldCls} />
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-2 font-semibold">📞 Phone</label>
        <PhonePad value={phone} onChange={setPhone} />
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1 font-semibold">✉️ Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="customer@example.com"
          className={fieldCls} />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving || ok}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
          {saving ? 'Saving…' : 'Save Contact'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Transcript Modal ───────────────────────────────────────────────────────────
type ReviewRow = DashboardData['recentReviews'][0]

function TranscriptModal({
  review,
  onClose,
  onStatusChange,
  onLeadChange,
}: {
  review: ReviewRow
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
  onLeadChange:   (id: string, lead: { name: string | null; phone: string | null; email: string | null }) => void
}) {
  const [status,    setStatus]    = useState(review.status)
  const [saving,    setSaving]    = useState(false)
  const [editLead,  setEditLead]  = useState(false)
  const [lead,      setLead]      = useState({
    name:  review.leadName,
    phone: review.leadPhone,
    email: review.leadEmail,
  })

  async function cycleStatus() {
    const next = STATUS_META[status]?.next ?? 'pending'
    setSaving(true)
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: next }),
      })
      if (res.ok) { setStatus(next); onStatusChange(review.id, next) }
    } finally { setSaving(false) }
  }

  function handleLeadSaved(updated: { name: string | null; phone: string | null; email: string | null }) {
    setLead(updated)
    setEditLead(false)
    onLeadChange(review.id, updated)
  }

  const messages: Array<{ role: string; content: string }> = (() => {
    try { return JSON.parse(review.transcript ?? '[]') } catch { return [] }
  })().filter((m: { role: string; content: string }) => m.content !== '__GREET__')

  const keyPoints: string[] = (() => {
    try { return JSON.parse(review.keyPoints ?? '[]') } catch { return [] }
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-2xl max-h-[90dvh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">{SENTIMENT_EMOJI[review.sentiment ?? ''] ?? '💬'}</span>
              <span className="text-sm font-bold text-slate-900 break-words">🏪 {review.shopName}</span>
              {review.category && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize border border-slate-200">
                  {CATEGORY_EMOJI[review.category]} {review.category}
                </span>
              )}
              {review.rating && (
                <span className="text-xs text-yellow-500 font-semibold">{RATING_EMOJI[review.rating]} {review.rating}★</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(review.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              {review.subcategory && ` · ${review.subcategory}`}
            </p>
          </div>
          <button onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none p-1">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Contact + Status row */}
          <div className="flex flex-col sm:flex-row gap-4">

            {/* Contact card */}
            <div className={`flex-1 ${insetCls} rounded-xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Customer Contact</p>
                {review.leadId && !editLead && (
                  <button onClick={() => setEditLead(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-0.5 rounded-lg hover:bg-blue-50 transition-colors">
                    ✏️ Edit
                  </button>
                )}
              </div>

              {editLead ? (
                <EditContactPanel
                  review={{ ...review, leadName: lead.name, leadPhone: lead.phone, leadEmail: lead.email }}
                  onSaved={handleLeadSaved}
                  onCancel={() => setEditLead(false)}
                />
              ) : (lead.name || lead.phone || lead.email) ? (
                <div className="space-y-2">
                  {lead.name && <p className="text-sm text-slate-800">👤 {lead.name}</p>}
                  {lead.phone && (
                    <p className="text-sm text-slate-800 flex items-center gap-2">
                      📞 <button onClick={() => navigator.clipboard.writeText(lead.phone!)}
                        className="text-blue-600 hover:underline font-mono" title="Tap to copy">
                        {lead.phone}
                      </button>
                    </p>
                  )}
                  {lead.email && (
                    <p className="text-sm text-slate-800 flex items-center gap-2 break-words">
                      ✉️ <button onClick={() => navigator.clipboard.writeText(lead.email!)}
                        className="text-blue-600 hover:underline break-all" title="Tap to copy">
                        {lead.email}
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No contact details provided</p>
              )}
            </div>

            {/* Status card */}
            {!editLead && (
              <div className={`flex-1 ${insetCls} rounded-xl p-4 flex flex-col gap-3`}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Follow-up Status</p>
                <StatusBadge status={status} />
                <button onClick={cycleStatus} disabled={saving}
                  className="mt-auto px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40 transition-colors">
                  {saving ? 'Saving…' : STATUS_META[status]?.nextLabel ?? 'Update'}
                </button>
              </div>
            )}
          </div>

          {/* Summary */}
          {!editLead && review.summary && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-200">
                {review.summary}
              </p>
            </div>
          )}

          {/* Key Points */}
          {!editLead && keyPoints.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Key Points</p>
              <ul className="space-y-1.5">
                {keyPoints.map((kp, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className="text-blue-500 shrink-0 mt-0.5">•</span>
                    <span>{kp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          {!editLead && messages.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Full Transcript</p>
              <div className="space-y-2">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-slate-100 text-slate-800 rounded-bl-md border border-slate-200'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Reviews Panel (full reviews tab) ──────────────────────────────────────────
const SENTIMENT_FILTERS = ['all', 'complaint', 'negative', 'positive', 'suggestion'] as const
const STATUS_FILTERS    = ['all', 'pending', 'contacted', 'resolved'] as const

function ReviewsPanel({ reviews: initial }: { reviews: DashboardData['recentReviews'] }) {
  const [reviews, setReviews]         = useState(initial)
  const [sentFilter, setSentFilter]   = useState<string>('all')
  const [statFilter, setStatFilter]   = useState<string>('all')
  const [selected, setSelected]       = useState<ReviewRow | null>(null)

  const handleStatusChange = useCallback((id: string, status: string) => {
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status } : r))
    setSelected((prev) => prev?.id === id ? { ...prev, status } : prev)
  }, [])

  const handleLeadChange = useCallback((id: string, lead: { name: string | null; phone: string | null; email: string | null }) => {
    setReviews((prev) => prev.map((r) => r.id === id
      ? { ...r, leadName: lead.name, leadPhone: lead.phone, leadEmail: lead.email }
      : r))
    setSelected((prev) => prev?.id === id
      ? { ...prev, leadName: lead.name, leadPhone: lead.phone, leadEmail: lead.email }
      : prev)
  }, [])

  const filtered = reviews.filter((r) => {
    const sentOk = sentFilter === 'all' || r.sentiment === sentFilter
    const statOk = statFilter === 'all' || r.status === statFilter
    return sentOk && statOk
  })

  const pendingCount = reviews.filter((r) => r.sentiment !== 'positive' && r.status === 'pending').length

  return (
    <>
      {selected && (
        <TranscriptModal
          review={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onLeadChange={handleLeadChange}
        />
      )}

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sentiment filter */}
          {SENTIMENT_FILTERS.map((f) => (
            <button key={f} onClick={() => setSentFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors border ${
                sentFilter === f
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>
              {f === 'all' ? 'All Sentiment' : `${SENTIMENT_EMOJI[f] ?? ''} ${f}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setStatFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors border ${
                statFilter === f
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>
              {f === 'all' ? 'All Status' : f}
            </button>
          ))}
          {pendingCount > 0 && (
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
              {pendingCount} need follow-up
            </span>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-400 text-sm text-center py-12">No reviews match the selected filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <button key={r.id} onClick={() => setSelected(r)}
              className={`w-full text-left flex gap-3 p-3.5 ${insetCls} rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors group`}>
              <span className="text-xl mt-0.5 shrink-0">
                {SENTIMENT_EMOJI[r.sentiment ?? ''] ?? '💬'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-xs font-semibold text-slate-800 break-words">🏪 {r.shopName}</span>
                    {r.category && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 capitalize">
                        {CATEGORY_EMOJI[r.category]} {r.category}
                      </span>
                    )}
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.rating && <span className="text-xs text-yellow-500 font-semibold">{RATING_EMOJI[r.rating]} {r.rating}★</span>}
                    <span className="text-xs text-slate-500">
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{r.summary}</p>
                {(r.leadName || r.leadPhone) && (
                  <p className="text-xs text-slate-400 mt-1">
                    {r.leadName && `👤 ${r.leadName}`}{r.leadPhone && ` · 📞 ${r.leadPhone}`}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
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
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          ref={inputRef}
          type="text" value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(query)}
          placeholder="e.g. Which outlet has the most behavioral complaints?"
          className={`${inputCls} flex-1`}
        />
        <button
          onClick={() => search(query)} disabled={loading || !query.trim()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {loading ? '...' : '🔍 Ask'}
        </button>
      </div>
      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button key={q} onClick={() => search(q)}
              className="text-xs px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 rounded-full border border-slate-200 transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}
      {loading && (
        <div className="flex items-center gap-3 py-6 text-slate-400 text-sm">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Analysing reviews…
        </div>
      )}
      {error && <p className="text-sm text-red-400 mt-2">❌ {error}</p>}
      {result && (
        <div className="mt-4">
          <div className="bg-blue-50 rounded-xl p-4 mb-4 border-l-4 border-blue-600">
            <p className="text-xs text-blue-700 font-bold mb-2 uppercase tracking-widest">🤖 AI Analysis</p>
            <p className="text-slate-800 text-sm leading-relaxed">{result.answer}</p>
          </div>
          {result.sources.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-widest">
                📋 Based on {result.sources.length} matching review{result.sources.length !== 1 ? 's' : ''}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.sources.map((s) => (
                  <div key={s.id} className={`${insetCls} rounded-lg p-3`}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-slate-800 break-words">🏪 {s.shop}</span>
                      <span className="text-sm">{SENTIMENT_EMOJI[s.sentiment ?? ''] ?? '💬'}</span>
                    </div>
                    {s.category && (
                      <p className="text-xs text-slate-500 mb-1 capitalize">
                        {CATEGORY_EMOJI[s.category]} {s.category}{s.subcategory ? ` · ${s.subcategory}` : ''}
                      </p>
                    )}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{s.summary}</p>
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
    <div className="min-h-dvh bg-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-7xl mb-4">📊</div>
        <p className="text-xl font-bold text-slate-900">No reviews yet</p>
        <p className="text-sm text-slate-500 mt-2">Reviews will appear once customers start leaving feedback.</p>
      </div>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export function DashboardClient({ data }: { data: DashboardData | null }) {
  const router = useRouter()
  const [tab, setTab] = useState<'analytics' | 'reviews' | 'shops'>('analytics')

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
    <div className="min-h-dvh bg-[linear-gradient(135deg,#f8fafc_0%,#eef4ff_48%,#f5f7fb_100%)] text-slate-900 font-sans">
      <div className="mx-auto w-full max-w-[1720px] px-4 py-6 sm:px-6 lg:px-8 xl:px-10">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 break-words">📊 Customer Review Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Management Dashboard · Real-time outlet performance</p>
          {/* Tab bar */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <button
              onClick={() => setTab('analytics')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                tab === 'analytics'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : `${secondaryBtnCls}`
              }`}
            >
              📊 Analytics
            </button>
            <button
              onClick={() => setTab('reviews')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                tab === 'reviews'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : `${secondaryBtnCls}`
              }`}
            >
              📋 Reviews
              {data.recentReviews.filter((r) => r.sentiment !== 'positive' && r.status === 'pending').length > 0 && (
                <span className="ml-2 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
                  {data.recentReviews.filter((r) => r.sentiment !== 'positive' && r.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('shops')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors border ${
                tab === 'shops'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : `${secondaryBtnCls}`
              }`}
            >
              🏪 Shops
            </button>
          </div>
        </div>
        <div className="text-left sm:text-right text-xs text-slate-500">
          <p>🗓️ Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className="mt-1">🗄️ Powered by SQLite · sqlite-vec</p>
          {/* Logout button */}
          <button
            onClick={async () => {
              await fetch('/api/dashboard/auth', { method: 'DELETE' })
              router.push('/dashboard/login')
            }}
            className="mt-2 text-xs text-slate-500 hover:text-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <>
          {/* ── AI Search ───────────────────────────────────────────────── */}
          <SearchPanel />

          {/* ── Executive KPIs ──────────────────────────────────────────── */}
          <SectionTitle>Executive Summary</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 gap-4 mb-8">
            <KpiCard emoji="📊" label="Total"       value={totalReviews} color={DASHBOARD_ACCENT} highlight />
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
              color={DASHBOARD_ACCENT_DARK} />
            <KpiCard emoji="⭐" label="Avg Rating"
              value={avgRating !== null ? `${avgRating}/5` : '—'}
              color="#eab308" />
            <KpiCard emoji={satisfactionEmoji} label="Satisfaction"
              value={satisfaction !== null ? `${satisfaction}%` : '—'}
              color={satisfactionColor} />
          </div>

          <Divider />

          {/* ── Sentiment + Category ────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">

            {/* Sentiment Analysis */}
            <Card>
              <SectionTitle>😊 Sentiment Breakdown</SectionTitle>
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <ResponsiveContainer width="100%" height={220} minWidth={180}>
                  <PieChart>
                    <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                      {sentimentPie.map((s) => <Cell key={s.name} fill={s.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
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

          {/* ── Shop Performance ────────────────────────────────────────── */}
          <SectionTitle>🏪 Outlet Performance</SectionTitle>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">
            {rankedShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} rank={i + 1} />)}
          </div>

          <Divider />

          {/* ── Top Issues + Top Suggestions ────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">

            {/* Top Issues */}
            <Card>
              <SectionTitle>🔴 Top Issues Requiring Attention</SectionTitle>
              {topIssues.length === 0
                ? <p className="text-slate-500 text-sm">No critical issues found 🎉</p>
                : (
                  <div className="space-y-2">
                    {topIssues.map((issue, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2.5 ${insetCls} rounded-lg`}>
                        <span className="text-base">{PRIORITY_EMOJI[issue.sentiment] ?? '🟢'}</span>
                        <span className="text-base">{CATEGORY_EMOJI[issue.category] ?? '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 capitalize break-words">{issue.subcategory}</p>
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
                      <div key={i} className={`flex items-center gap-3 p-2.5 ${insetCls} rounded-lg`}>
                        <span className="text-base">💡</span>
                        <span className="text-base">{CATEGORY_EMOJI[s.category] ?? '📌'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 capitalize break-words">{s.subcategory}</p>
                          <p className="text-xs text-slate-500 capitalize">{s.category}</p>
                        </div>
                        <span className="text-sm font-bold text-[#6366f1] shrink-0">{s.count}×</span>
                      </div>
                    ))}
                  </div>
                )}
            </Card>
          </div>

          {/* ── Trend + Rating Distribution ─────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">

            {/* Monthly Trend */}
            <Card>
              <SectionTitle>📈 Monthly Review Trend</SectionTitle>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="month" tick={{ fill: CHART_TICK, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_TICK, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                    labelStyle={{ color: '#0f172a' }} />
                  <Line type="monotone" dataKey="count" stroke={DASHBOARD_ACCENT} strokeWidth={2.5}
                    dot={{ fill: DASHBOARD_ACCENT, r: 4 }} />
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
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Overall Average</span>
                  <span className="text-lg font-bold text-yellow-400">⭐ {avgRating} / 5</span>
                </div>
              )}
            </Card>
          </div>

          {/* ── Recent Reviews (preview, click to see all) ──────────────── */}
          <Card className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>🕐 Recent Reviews</SectionTitle>
              <button onClick={() => setTab('reviews')}
                className="text-xs text-blue-600 hover:underline font-semibold">
                View all →
              </button>
            </div>
            <ReviewsPanel reviews={recentReviews.slice(0, 6)} />
          </Card>

          <p className="text-center text-slate-700 text-xs mt-8">
            📊 VoiceAgent · Customer Review Analytics · © {new Date().getFullYear()}
          </p>
        </>
      )}

      {tab === 'reviews' && (
        <Card>
          <SectionTitle>📋 All Reviews — Follow-up Tracker</SectionTitle>
          <ReviewsPanel reviews={recentReviews} />
        </Card>
      )}

      {tab === 'shops' && <ShopsPanel />}
      </div>
    </div>
  )
}

// ── ShopsPanel ─────────────────────────────────────────────────────────────────

interface ShopRow {
  id: string
  tenantId: string
  name: string
  city: string | null
  state: string | null
  town: string | null
  address: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  lat: number | null
  lng: number | null
  branchCode: string | null
  createdAt: string
}

// Shape of the edit form while the user is editing a shop
interface EditFormState {
  name: string
  city: string
  state: string
  town: string
  address: string
  phone: string
  mobile: string
  email: string
  lat: string
  lng: string
}

function shopToForm(shop: ShopRow): EditFormState {
  return {
    name:    shop.name,
    city:    shop.city    ?? '',
    state:   shop.state   ?? '',
    town:    shop.town    ?? '',
    address: shop.address ?? '',
    phone:   shop.phone   ?? '',
    mobile:  shop.mobile  ?? '',
    email:   shop.email   ?? '',
    lat:     shop.lat     !== null ? String(shop.lat) : '',
    lng:     shop.lng     !== null ? String(shop.lng) : '',
  }
}

// ── Single shop card (view mode) ───────────────────────────────────────────────
function ShopViewCard({
  shop,
  onEdit,
}: {
  shop: ShopRow
  onEdit: () => void
}) {
  return (
    <div className={`${surfaceCls} rounded-xl p-5 flex flex-col gap-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 break-words">🏪 {shop.name}</p>
          {shop.branchCode && (
            <p className="text-xs text-slate-500 mt-0.5">Code: {shop.branchCode}</p>
          )}
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 px-3 py-1 bg-white hover:bg-blue-50 text-xs text-slate-600 hover:text-blue-700 rounded-lg transition-colors font-semibold border border-slate-200"
        >
          Edit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-500">
        {shop.state   && <span>📍 {shop.state}</span>}
        {shop.city    && <span>🏙️ {shop.city}</span>}
        {shop.town    && <span>🗺️ {shop.town}</span>}
        {shop.address && <span className="sm:col-span-2 text-slate-600 break-words">{shop.address}</span>}
        {shop.phone   && <span>📞 {shop.phone}</span>}
        {shop.mobile  && <span>📱 {shop.mobile}</span>}
        {shop.email   && <span className="sm:col-span-2 break-words">✉️ {shop.email}</span>}
        {(shop.lat !== null && shop.lng !== null) && (
          <span className="sm:col-span-2">
            🌐 {shop.lat?.toFixed(5)}, {shop.lng?.toFixed(5)}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Single shop card (edit mode) ───────────────────────────────────────────────
function ShopEditCard({
  shop,
  onSaved,
  onCancel,
}: {
  shop: ShopRow
  onSaved: (updated: ShopRow) => void
  onCancel: () => void
}) {
  const [form, setForm]       = useState<EditFormState>(shopToForm(shop))
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState(false)
  const [errMsg, setErrMsg]   = useState<string | null>(null)

  // Derive city list based on selected state
  const cityOptions: string[] = form.state ? (CITIES_BY_PROVINCE[form.state] ?? []) : []
  const freeCityInput = cityOptions.length === 0

  function set(field: keyof EditFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
    }
  }

  // If state changes, reset city only if the current city is not in the new list
  function handleStateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newState = e.target.value
    const newCities = CITIES_BY_PROVINCE[newState] ?? []
    setForm((prev) => ({
      ...prev,
      state: newState,
      city: newCities.includes(prev.city) ? prev.city : '',
    }))
  }

  function detectLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
        }))
      },
      () => { /* ignore errors silently */ },
    )
  }

  async function handleSave() {
    setSaving(true)
    setErrMsg(null)
    try {
      const res = await fetch(`/api/shops/${shop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    form.name,
          city:    form.city,
          state:   form.state,
          town:    form.town,
          address: form.address,
          phone:   form.phone,
          mobile:  form.mobile,
          email:   form.email,
          lat:     form.lat,
          lng:     form.lng,
        }),
      })
      const data = await res.json() as ShopRow & { error?: string }
      if (!res.ok) {
        setErrMsg(data.error ?? 'Save failed')
        return
      }
      onSaved(data)
      setToast(true)
      setTimeout(() => setToast(false), 2500)
    } catch {
      setErrMsg('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const shopInputCls = 'w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-colors'
  const labelCls = 'block text-xs text-slate-600 mb-1'

  return (
    <div className={`${surfaceCls} rounded-xl p-5 flex flex-col gap-4 ring-4 ring-blue-50`}>
      {/* Success toast */}
      {toast && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg text-center">
          Saved!
        </div>
      )}
      {errMsg && (
        <p className="text-sm text-red-600">{errMsg}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className={labelCls}>Name</label>
          <input type="text" value={form.name} onChange={set('name')} className={shopInputCls} />
        </div>

        {/* Branch Code — readonly */}
        <div>
          <label className={labelCls}>Branch Code</label>
          <input type="text" value={shop.branchCode ?? ''} disabled readOnly className={`${shopInputCls} opacity-60 cursor-not-allowed bg-slate-50`} />
        </div>

        {/* State/Province */}
        <div>
          <label className={labelCls}>Province / State</label>
          <select value={form.state} onChange={handleStateChange} className={shopInputCls}>
            <option value="">— Select province —</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* City — dropdown if province has cities, otherwise free text */}
        <div>
          <label className={labelCls}>City</label>
          {freeCityInput ? (
            <input type="text" value={form.city} onChange={set('city')} placeholder="Enter city" className={shopInputCls} />
          ) : (
            <select value={form.city} onChange={set('city')} className={shopInputCls}>
              <option value="">— Select city —</option>
              {cityOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Town */}
        <div>
          <label className={labelCls}>Town / Area</label>
          <input type="text" value={form.town} onChange={set('town')} placeholder="e.g. Model Town" className={shopInputCls} />
        </div>

        {/* Phone */}
        <div>
          <label className={labelCls}>Phone</label>
          <input type="text" value={form.phone} onChange={set('phone')} placeholder="+92 XX XXXXXXX" className={shopInputCls} />
        </div>

        {/* Mobile */}
        <div>
          <label className={labelCls}>Mobile</label>
          <input type="text" value={form.mobile} onChange={set('mobile')} placeholder="+92 3XX XXXXXXX" className={shopInputCls} />
        </div>

        {/* Email */}
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={form.email} onChange={set('email')} placeholder="shop@example.com" className={shopInputCls} />
        </div>

        {/* Address — full width */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Address</label>
          <textarea rows={2} value={form.address} onChange={set('address')} placeholder="Street address" className={shopInputCls} />
        </div>

        {/* Latitude */}
        <div>
          <label className={labelCls}>Latitude</label>
          <input type="number" step="0.000001" value={form.lat} onChange={set('lat')} placeholder="e.g. 33.6844" className={shopInputCls} />
        </div>

        {/* Longitude */}
        <div>
          <label className={labelCls}>Longitude</label>
          <input type="number" step="0.000001" value={form.lng} onChange={set('lng')} placeholder="e.g. 73.0479" className={shopInputCls} />
        </div>

        {/* Detect location button — full width */}
        <div className="sm:col-span-2">
          <button
            type="button"
            onClick={detectLocation}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-xs text-slate-700 rounded-lg border border-slate-300 transition-colors"
          >
            📍 Detect Location
          </button>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-1 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2 bg-white hover:bg-slate-50 text-sm text-slate-700 rounded-lg border border-slate-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── ShopsPanel — fetches shops and renders the grid ───────────────────────────
function ShopsPanel() {
  const [shops, setShops]     = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/shops')
      .then((r) => r.json())
      .then((data: ShopRow[]) => setShops(data))
      .catch(() => { /* silently fail — shops will just remain empty */ })
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(updated: ShopRow) {
    setShops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
    setEditingId(null)
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-16 text-slate-400 text-sm justify-center">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        Loading shops…
      </div>
    )
  }

  if (shops.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-400 text-sm">No shops found.</p>
      </div>
    )
  }

  return (
    <div>
      <SectionTitle>🏪 Shop Management</SectionTitle>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {shops.map((shop) =>
          editingId === shop.id ? (
            <ShopEditCard
              key={shop.id}
              shop={shop}
              onSaved={handleSaved}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <ShopViewCard
              key={shop.id}
              shop={shop}
              onEdit={() => setEditingId(shop.id)}
            />
          ),
        )}
      </div>
    </div>
  )
}
