'use client'

import { useState, useRef, useEffect, useCallback, useMemo, type CSSProperties } from 'react'
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
// ── Display helpers ────────────────────────────────────────────────────────────
// Strip default sentinel values stored when the customer didn't share details.
const UNKNOWN_NAME  = 'Unknown'
const UNKNOWN_EMAIL = 'unknown@email.com'
function fmtContact(v: string | null | undefined): string | null {
  if (!v || v === UNKNOWN_NAME || v === UNKNOWN_EMAIL) return null
  return v
}
function fmtText(v: string | null | undefined, fallback = '—'): string {
  return v?.trim() || fallback
}
function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} · ${time}`
}
function fmtDateTimeShort(dateStr: string): string {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date}, ${time}`
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
const CHART_GRID = '#e5eaf2'
const CHART_TICK = '#64748b'
const DASHBOARD_ACCENT = '#2563eb'

const surfaceCls = 'bg-[var(--dash-surface)] border border-[var(--dash-border)] shadow-[0_18px_50px_var(--dash-shadow)]'
const insetCls = 'bg-[var(--dash-inset)] border border-[var(--dash-border)]'
const inputCls = 'w-full bg-[var(--dash-input)] border border-[var(--dash-input-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--dash-text)] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[var(--dash-ring)] focus:border-[var(--dash-accent)] transition-colors'

type DashboardThemeKey = 'light' | 'day' | 'dark' | 'night'

const DASHBOARD_THEMES: Record<DashboardThemeKey, {
  name: string
  bgClass: string
  accent: string
  accentDark: string
  accentSoft: string
  mode: 'light' | 'dark'
  vars: CSSProperties
  statPanel: string
  tabHover: string
  positivePanel: string
  queuePanel: string
}> = {
  light: {
    name: 'Light',
    bgClass: 'bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_30rem),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.10),transparent_28rem),linear-gradient(135deg,#f8fafc_0%,#eef4ff_48%,#ffffff_100%)]',
    accent: '#1d4ed8',
    accentDark: '#0f172a',
    accentSoft: '#dbeafe',
    mode: 'light',
    vars: {
      '--dash-surface': 'rgb(255 255 255 / 0.96)',
      '--dash-inset': 'rgb(248 250 252 / 0.92)',
      '--dash-input': '#ffffff',
      '--dash-input-border': '#cbd5e1',
      '--dash-border': '#dbe3ee',
      '--dash-heading': '#0f172a',
      '--dash-text': '#334155',
      '--dash-muted': '#64748b',
      '--dash-subtle': '#94a3b8',
      '--dash-shadow': 'rgb(15 23 42 / 0.08)',
      '--dash-ring': 'rgb(219 234 254 / 0.9)',
      '--dash-accent': '#1d4ed8',
    } as CSSProperties,
    statPanel: 'bg-blue-50 text-blue-900 border-blue-100',
    tabHover: 'hover:border-blue-300 hover:text-blue-700',
    positivePanel: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    queuePanel: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  day: {
    name: 'Day',
    bgClass: 'bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.16),transparent_30rem),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.13),transparent_30rem),linear-gradient(135deg,#eff9fb_0%,#f8fbff_48%,#edf7ff_100%)]',
    accent: '#0891b2',
    accentDark: '#164e63',
    accentSoft: '#cffafe',
    mode: 'light',
    vars: {
      '--dash-surface': 'rgb(255 255 255 / 0.94)',
      '--dash-inset': 'rgb(236 254 255 / 0.58)',
      '--dash-input': '#ffffff',
      '--dash-input-border': '#bae6fd',
      '--dash-border': '#c7e6ef',
      '--dash-heading': '#0c2630',
      '--dash-text': '#274653',
      '--dash-muted': '#5d7782',
      '--dash-subtle': '#8aa2ac',
      '--dash-shadow': 'rgb(8 47 73 / 0.09)',
      '--dash-ring': 'rgb(207 250 254 / 0.9)',
      '--dash-accent': '#0891b2',
    } as CSSProperties,
    statPanel: 'bg-cyan-50 text-cyan-900 border-cyan-100',
    tabHover: 'hover:border-cyan-300 hover:text-cyan-700',
    positivePanel: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    queuePanel: 'border-blue-200 bg-blue-50 text-blue-700',
  },
  dark: {
    name: 'Dark',
    bgClass: 'bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_31rem),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.12),transparent_30rem),linear-gradient(135deg,#101827_0%,#172033_50%,#0f172a_100%)]',
    accent: '#60a5fa',
    accentDark: '#2563eb',
    accentSoft: '#1e3a8a',
    mode: 'dark',
    vars: {
      '--dash-surface': 'rgb(23 32 51 / 0.92)',
      '--dash-inset': 'rgb(15 23 42 / 0.66)',
      '--dash-input': 'rgb(15 23 42 / 0.9)',
      '--dash-input-border': 'rgb(71 85 105 / 0.9)',
      '--dash-border': 'rgb(71 85 105 / 0.62)',
      '--dash-heading': '#f8fafc',
      '--dash-text': '#dbeafe',
      '--dash-muted': '#a9bbd2',
      '--dash-subtle': '#7f93ad',
      '--dash-shadow': 'rgb(0 0 0 / 0.28)',
      '--dash-ring': 'rgb(96 165 250 / 0.22)',
      '--dash-accent': '#60a5fa',
    } as CSSProperties,
    statPanel: 'bg-slate-800/80 text-slate-100 border-slate-700',
    tabHover: 'hover:border-blue-300 hover:text-blue-200',
    positivePanel: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200',
    queuePanel: 'border-amber-500/30 bg-amber-500/12 text-amber-200',
  },
  night: {
    name: 'Night',
    bgClass: 'bg-[radial-gradient(circle_at_top_left,rgba(129,140,248,0.20),transparent_30rem),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.10),transparent_29rem),linear-gradient(135deg,#030712_0%,#0b1020_46%,#111827_100%)]',
    accent: '#a78bfa',
    accentDark: '#4c1d95',
    accentSoft: '#312e81',
    mode: 'dark',
    vars: {
      '--dash-surface': 'rgb(12 18 32 / 0.94)',
      '--dash-inset': 'rgb(17 24 39 / 0.72)',
      '--dash-input': 'rgb(3 7 18 / 0.94)',
      '--dash-input-border': 'rgb(75 85 99 / 0.82)',
      '--dash-border': 'rgb(75 85 99 / 0.58)',
      '--dash-heading': '#f9fafb',
      '--dash-text': '#e5e7eb',
      '--dash-muted': '#b7c0cf',
      '--dash-subtle': '#818ca0',
      '--dash-shadow': 'rgb(0 0 0 / 0.36)',
      '--dash-ring': 'rgb(167 139 250 / 0.24)',
      '--dash-accent': '#a78bfa',
    } as CSSProperties,
    statPanel: 'bg-violet-500/10 text-violet-100 border-violet-400/25',
    tabHover: 'hover:border-violet-300 hover:text-violet-200',
    positivePanel: 'border-teal-400/25 bg-teal-400/10 text-teal-100',
    queuePanel: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100',
  },
}

// ── Shared UI primitives ───────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${surfaceCls} rounded-xl p-4 lg:p-5 ${className}`}>{children}</div>
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-[0.68rem] font-black text-[var(--dash-muted)] uppercase tracking-[0.16em]">{children}</h2>
}
function Divider() {
  return <div className="border-t border-slate-200 my-8" />
}

function Dot({ color = DASHBOARD_ACCENT }: { color?: string }) {
  return <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, color = '#6c8ef7', highlight = false,
}: {
  label: string; value: string | number
  sub?: string; color?: string; highlight?: boolean
}) {
  return (
    <div className={`${surfaceCls} flex min-h-[6.5rem] flex-col justify-between overflow-hidden rounded-xl border p-4 ${highlight ? 'border-blue-300 ring-2 ring-blue-50' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.66rem] font-black text-[var(--dash-muted)] uppercase tracking-[0.14em]">{label}</span>
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
      </div>
      <span className="mt-3 text-2xl font-black leading-none text-[var(--dash-heading)] sm:text-3xl">{value}</span>
      {sub && <span className="mt-2 text-xs font-semibold text-[var(--dash-muted)]">{sub}</span>}
      {!sub && <span className="mt-2 text-xs font-semibold text-[var(--dash-subtle)]">Current dataset</span>}
    </div>
  )
}

function InsightCard({
  label,
  value,
  detail,
  tone = 'blue',
}: {
  label: string
  value: string | number
  detail: string
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'slate'
}) {
  const tones = {
    blue:  'border-blue-200 bg-blue-50/80 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50/80 text-amber-700',
    red:   'border-red-200 bg-red-50/80 text-red-700',
    slate: 'border-slate-200 bg-slate-50/90 text-slate-700',
  }
  return (
    <div className={`rounded-xl border p-3.5 ${tones[tone]}`}>
      <p className="text-[0.64rem] font-black uppercase tracking-[0.14em] opacity-75">{label}</p>
      <p className="mt-2 text-xl font-black leading-tight">{value}</p>
      <p className="mt-1.5 text-xs font-semibold leading-5 opacity-80">{detail}</p>
    </div>
  )
}

function ThemeSelector({
  selected,
  onSelect,
}: {
  selected: DashboardThemeKey
  onSelect: (theme: DashboardThemeKey) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
      {(Object.entries(DASHBOARD_THEMES) as Array<[DashboardThemeKey, typeof DASHBOARD_THEMES[DashboardThemeKey]]>).map(([key, theme]) => {
        const active = selected === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`flex min-w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition-colors ${
              active ? 'text-white border-transparent shadow-sm' : 'bg-[var(--dash-input)] text-[var(--dash-text)] border-[var(--dash-border)] hover:border-slate-400'
            }`}
            style={active ? { background: theme.accentDark } : undefined}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.accent }} />
            {theme.name}
          </button>
        )
      })}
    </div>
  )
}

// ── Sentiment Row ──────────────────────────────────────────────────────────────
function SentimentRow({ sentiment, count, total }: { sentiment: string; count: number; total: number }) {
  const pct   = total ? Math.round((count / total) * 100) : 0
  const color = SENTIMENT_COLOR[sentiment] ?? '#6c8ef7'
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Dot color={color} />
      <span className="text-sm font-semibold text-slate-700 w-24">{SENTIMENT_LABEL[sentiment]}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-sm font-black w-8 text-right" style={{ color }}>{count}</span>
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
    <div className="grid grid-cols-[minmax(5rem,8rem)_1fr] sm:grid-cols-[8rem_1fr_auto] items-center gap-3 py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm font-bold text-slate-700 capitalize min-w-0 break-words">{name}</span>
      <div className="flex min-w-0 gap-0.5 h-5 rounded-lg overflow-hidden bg-slate-100">
        {data.positive   > 0 && <div style={{ width: `${pctPos}%`,  background: '#22c55e' }} title={`Positive ${data.positive}`} />}
        {data.negative   > 0 && <div style={{ width: `${pctNeg}%`,  background: '#f97316' }} title={`Negative ${data.negative}`} />}
        {data.complaint  > 0 && <div style={{ width: `${pctComp}%`, background: '#ef4444' }} title={`Complaint ${data.complaint}`} />}
        {data.suggestion > 0 && <div style={{ width: `${pctSugg}%`, background: '#6366f1' }} title={`Suggestion ${data.suggestion}`} />}
      </div>
      <div className="col-span-2 sm:col-span-1 flex gap-2 text-xs font-bold flex-wrap justify-start sm:justify-end">
        <span className="text-[#22c55e]">P {data.positive}</span>
        <span className="text-[#f97316]">N {data.negative}</span>
        <span className="text-[#ef4444]">C {data.complaint}</span>
        {data.suggestion > 0 && <span className="text-[#6366f1]">S {data.suggestion}</span>}
      </div>
    </div>
  )
}

// ── Rating Bar ─────────────────────────────────────────────────────────────────
function RatingBar({ rating, count, max }: { rating: number; count: number; max: number }) {
  const pct = max ? Math.round((count / max) * 100) : 0
  const colors = ['', '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e']
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-xs font-black text-slate-500 w-8">{rating} star</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2.5">
        <div className="h-2.5 rounded-full" style={{ width: `${pct}%`, background: colors[rating] }} />
      </div>
      <span className="text-xs font-black text-slate-700 w-6 text-right">{count}</span>
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

  return (
    <div className={`${surfaceCls} rounded-2xl p-5`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-xs font-black text-white">#{rank}</span>
            <span className="text-base font-black text-slate-950 break-words">{shop.name}</span>
          </div>
          {shop.city && <p className="text-sm font-semibold text-slate-500 mt-1">{shop.city}</p>}
        </div>
        <div className="text-right">
          <div className="text-3xl font-black" style={{ color: scoreColor }}>
            {shop.satisfaction !== null ? `${shop.satisfaction}%` : '—'}
          </div>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Satisfaction</div>
        </div>
      </div>

      {/* Sentiment split */}
      <div className="flex gap-2 mb-4">
        {[
          { label: 'Positive',   count: shop.positive,   color: '#22c55e' },
          { label: 'Negative',   count: shop.negative,   color: '#f97316' },
          { label: 'Complaint',  count: shop.complaint,  color: '#ef4444' },
          { label: 'Idea', count: shop.suggestion, color: '#6366f1' },
        ].map((s) => (
          <div key={s.label} className="flex-1 bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100 min-w-0">
            <div className="mx-auto mb-1 h-1.5 w-8 rounded-full" style={{ background: s.color }} />
            <div className="text-xl font-black" style={{ color: s.color }}>{s.count}</div>
            <div className="text-[0.68rem] font-bold text-slate-500 truncate">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Avg rating */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <span className="text-slate-500">Avg rating</span>
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

function TicketBadge({ ticketId, priority }: { ticketId: string | null; priority?: string | null }) {
  if (!ticketId) return null
  const color = priority === 'urgent' ? 'red' : priority === 'high' ? 'amber' : 'slate'
  const cls = color === 'red'
    ? 'border-red-200 bg-red-50 text-red-700'
    : color === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-slate-200 bg-slate-50 text-slate-700'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-black ${cls}`}>
      {ticketId}
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
  const [name,   setName]   = useState(fmtContact(review.leadName)  ?? '')
  const [phone,  setPhone]  = useState(review.leadPhone ?? '')
  const [email,  setEmail]  = useState(fmtContact(review.leadEmail) ?? '')
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
  const [saveErr,   setSaveErr]   = useState<string | null>(null)
  const [editLead,  setEditLead]  = useState(false)
  const [lead,      setLead]      = useState({
    name:  review.leadName,
    phone: review.leadPhone,
    email: review.leadEmail,
  })

  async function cycleStatus() {
    const next = STATUS_META[status]?.next ?? 'pending'
    setSaving(true); setSaveErr(null)
    try {
      const res = await fetch(`/api/reviews/${review.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: next }),
      })
      if (res.ok) {
        setStatus(next)
        onStatusChange(review.id, next)
      } else {
        const data = await res.json().catch(() => ({}))
        setSaveErr(data?.error ?? `Failed (${res.status})`)
      }
    } catch {
      setSaveErr('Network error — please retry')
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
              <TicketBadge ticketId={review.ticketId} priority={review.ticketPriority} />
              {review.rating && (
                <span className="text-xs text-yellow-500 font-semibold">{RATING_EMOJI[review.rating]} {review.rating}★</span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {fmtDateTime(review.createdAt)}
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
              ) : (() => {
                const dName  = fmtContact(lead.name)
                const dPhone = lead.phone || null
                const dEmail = fmtContact(lead.email)
                return (dName || dPhone || dEmail) ? (
                <div className="space-y-2">
                  {dName  && <p className="text-sm text-slate-800">👤 {dName}</p>}
                  {dPhone && (
                    <p className="text-sm text-slate-800 flex items-center gap-2">
                      📞 <button onClick={() => navigator.clipboard.writeText(dPhone)}
                        className="text-blue-600 hover:underline font-mono" title="Tap to copy">
                        {dPhone}
                      </button>
                    </p>
                  )}
                  {dEmail && (
                    <p className="text-sm text-slate-800 flex items-center gap-2 break-words">
                      ✉️ <button onClick={() => navigator.clipboard.writeText(dEmail!)}
                        className="text-blue-600 hover:underline break-all" title="Tap to copy">
                        {dEmail}
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No contact details provided</p>
              )
              })()}
            </div>

            {/* Status card */}
            {!editLead && (
              <div className={`flex-1 ${insetCls} rounded-xl p-4 flex flex-col gap-3`}>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Follow-up Status</p>
                <StatusBadge status={status} />
                {saveErr && (
                  <p className="text-xs text-red-500 font-semibold">{saveErr}</p>
                )}
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

          {!editLead && review.ticketId && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ticket</p>
                <p className="mt-1 font-mono text-sm font-black text-slate-900">{review.ticketId}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Priority</p>
                <p className="mt-1 text-sm font-black capitalize text-slate-900">{review.ticketPriority ?? 'normal'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">SLA</p>
                <p className="mt-1 text-sm font-black text-slate-900">
                  {review.slaDueAt
                    ? new Date(review.slaDueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : 'Queued'}
                </p>
              </div>
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

// ── Filter helpers ─────────────────────────────────────────────────────────────
const DATE_RANGES = [
  { label: 'Today',    days: 0 },
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: '3 months',days: 90 },
  { label: 'All time',days: -1 },
] as const

const CATEGORIES  = ['all','product','service','behavioral','facility','pricing','general'] as const
const SENTIMENTS  = ['all','complaint','negative','positive','suggestion'] as const
const STATUSES    = ['all','pending','contacted','resolved'] as const
const SORT_OPTIONS = [
  { label: 'Newest first',  fn: (a: ReviewRow, b: ReviewRow) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() },
  { label: 'Oldest first',  fn: (a: ReviewRow, b: ReviewRow) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() },
  { label: 'Rating ↑',      fn: (a: ReviewRow, b: ReviewRow) => (a.rating ?? 0) - (b.rating ?? 0) },
  { label: 'Rating ↓',      fn: (a: ReviewRow, b: ReviewRow) => (b.rating ?? 0) - (a.rating ?? 0) },
] as const

type SortKey = 0 | 1 | 2 | 3

interface ReviewFilters {
  search:    string
  dateRange: number   // days back, -1 = all
  shop:      string   // shop name or 'all'
  category:  string
  sentiment: string
  status:    string
  rating:    number   // 0 = all
  sort:      SortKey
}

const DEFAULT_FILTERS: ReviewFilters = {
  search: '', dateRange: -1, shop: 'all',
  category: 'all', sentiment: 'all', status: 'all',
  rating: 0, sort: 0,
}

function countActive(f: ReviewFilters): number {
  return [
    f.search !== '',
    f.dateRange !== -1,
    f.shop !== 'all',
    f.category !== 'all',
    f.sentiment !== 'all',
    f.status !== 'all',
    f.rating !== 0,
    f.sort !== 0,
  ].filter(Boolean).length
}

function applyFilters(reviews: ReviewRow[], f: ReviewFilters): ReviewRow[] {
  const q = f.search.toLowerCase().trim()
  const cutoff = f.dateRange >= 0
    ? Date.now() - f.dateRange * 86_400_000
    : 0

  return reviews
    .filter((r) => {
      if (f.dateRange >= 0 && new Date(r.createdAt).getTime() < cutoff) return false
      if (f.shop !== 'all'      && r.shopName  !== f.shop)      return false
      if (f.category !== 'all'  && r.category  !== f.category)  return false
      if (f.sentiment !== 'all' && r.sentiment !== f.sentiment)  return false
      if (f.status !== 'all'    && r.status    !== f.status)     return false
      if (f.rating !== 0        && r.rating    !== f.rating)     return false
      if (q) {
        const hay = [r.summary, r.subcategory, r.shopName, r.leadName, r.leadPhone, r.category]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    .sort(SORT_OPTIONS[f.sort].fn)
}

// ── Filter pill ────────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors border whitespace-nowrap ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}>
      {label}
    </button>
  )
}

// ── Reviews Panel ─────────────────────────────────────────────────────────────
function ReviewsPanel({ reviews: initial }: { reviews: DashboardData['recentReviews'] }) {
  const [reviews,   setReviews]   = useState(initial)
  const [filters,   setFilters]   = useState<ReviewFilters>(DEFAULT_FILTERS)
  const [open,      setOpen]      = useState(false)   // filter panel expanded
  const [selected,  setSelected]  = useState<ReviewRow | null>(null)

  const set = useCallback(<K extends keyof ReviewFilters>(key: K, val: ReviewFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: val })), [])

  const clearAll = useCallback(() => setFilters(DEFAULT_FILTERS), [])

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

  const shops       = useMemo(() => ['all', ...[...new Set(reviews.map((r) => r.shopName))].sort()], [reviews])
  const filtered    = useMemo(() => applyFilters(reviews, filters), [reviews, filters])
  const activeCount = countActive(filters)
  const pendingCount = reviews.filter((r) => r.sentiment !== 'positive' && r.status === 'pending').length

  const selCls = `${inputCls} text-xs py-1.5`

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

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-4">

        {/* Search + toggle row */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">🔍</span>
            <input
              type="text" value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              placeholder="Search reviews, outlet, customer name, phone…"
              className={`${inputCls} pl-8 text-sm`}
            />
            {filters.search && (
              <button onClick={() => set('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
            )}
          </div>

          {/* Filter toggle */}
          <button onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-colors ${
              open || activeCount > 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
            }`}>
            <span>⚙ Filters</span>
            {activeCount > 0 && (
              <span className="bg-white text-blue-600 text-xs font-black rounded-full w-5 h-5 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>

          {activeCount > 0 && (
            <button onClick={clearAll}
              className="px-3 py-2.5 text-xs font-semibold text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg bg-red-50 transition-colors">
              ✕ Clear all
            </button>
          )}
        </div>

        {/* Expandable filter panel */}
        {open && (
          <div className={`${insetCls} rounded-xl p-4 space-y-4`}>

            {/* Row 1: Date range + Shop + Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">📅 Date Range</p>
                <div className="flex flex-wrap gap-1.5">
                  {DATE_RANGES.map((d) => (
                    <Pill key={d.label} label={d.label}
                      active={filters.dateRange === d.days}
                      onClick={() => set('dateRange', d.days)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">🏪 Outlet</p>
                <select value={filters.shop} onChange={(e) => set('shop', e.target.value)} className={selCls}>
                  {shops.map((s) => (
                    <option key={s} value={s}>{s === 'all' ? 'All Outlets' : s}</option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">↕ Sort By</p>
                <select value={filters.sort}
                  onChange={(e) => set('sort', Number(e.target.value) as SortKey)}
                  className={selCls}>
                  {SORT_OPTIONS.map((s, i) => (
                    <option key={i} value={i}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Category */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">📂 Category</p>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <Pill key={c} active={filters.category === c}
                    label={c === 'all' ? 'All' : `${CATEGORY_EMOJI[c] ?? ''} ${c}`}
                    onClick={() => set('category', c)} />
                ))}
              </div>
            </div>

            {/* Row 3: Sentiment */}
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">😊 Sentiment</p>
              <div className="flex flex-wrap gap-1.5">
                {SENTIMENTS.map((s) => (
                  <Pill key={s} active={filters.sentiment === s}
                    label={s === 'all' ? 'All' : `${SENTIMENT_EMOJI[s] ?? ''} ${s}`}
                    onClick={() => set('sentiment', s)} />
                ))}
              </div>
            </div>

            {/* Row 4: Status + Rating */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">📌 Follow-up Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <Pill key={s} active={filters.status === s}
                      label={s === 'all' ? 'All' : s}
                      onClick={() => set('status', s)} />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">⭐ Rating</p>
                <div className="flex flex-wrap gap-1.5">
                  <Pill label="All" active={filters.rating === 0} onClick={() => set('rating', 0)} />
                  {[1,2,3,4,5].map((r) => (
                    <Pill key={r} active={filters.rating === r}
                      label={`${RATING_EMOJI[r]} ${r}★`}
                      onClick={() => set('rating', r)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results summary bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
          <span>
            Showing <span className="font-bold text-slate-800">{filtered.length}</span> of{' '}
            <span className="font-bold text-slate-800">{reviews.length}</span> reviews
          </span>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 bg-orange-100 text-orange-700 font-bold rounded-full border border-orange-200">
              {pendingCount} need follow-up
            </span>
          )}
        </div>
      </div>

      {/* ── Review list ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-slate-500 text-sm font-semibold">No reviews match the selected filters</p>
          <button onClick={clearAll} className="mt-3 text-xs text-blue-600 hover:underline">Clear filters</button>
        </div>
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
                    <TicketBadge ticketId={r.ticketId} priority={r.ticketPriority} />
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.rating && <span className="text-xs text-yellow-500 font-semibold">{RATING_EMOJI[r.rating]} {r.rating}★</span>}
                    <span className="text-xs text-slate-500">
                      {fmtDateTimeShort(r.createdAt)}
                    </span>
                    <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {fmtText(r.summary, 'No summary available')}
                </p>
                {(() => {
                  const n = fmtContact(r.leadName)
                  const p = r.leadPhone || null
                  return (n || p) ? (
                    <p className="text-xs text-slate-400 mt-1">
                      {n && `👤 ${n}`}{p && `${n ? ' · ' : ''}📞 ${p}`}
                    </p>
                  ) : null
                })()}
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
  'Which outlet has the most hygiene complaints?',
  'What are customers saying about staff behaviour?',
  'Show me all negative product reviews',
  'Which shop has the highest satisfaction?',
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
    <Card className="mb-5">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <SectionTitle>Review Intelligence</SectionTitle>
          <p className="text-xs font-semibold text-[var(--dash-muted)]">Ask the review database a business question.</p>
        </div>
        <span className="w-fit rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-widest text-blue-700">
          AI search
        </span>
      </div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
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
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {loading ? '...' : 'Ask'}
        </button>
      </div>
      {!result && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button key={q} onClick={() => search(q)}
              className="rounded-full border border-[var(--dash-border)] bg-[var(--dash-inset)] px-3 py-1.5 text-xs text-[var(--dash-muted)] transition-colors hover:bg-blue-50 hover:text-blue-700">
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
            <p className="text-xs text-blue-700 font-bold mb-2 uppercase tracking-widest">AI analysis</p>
            <p className="text-slate-800 text-sm leading-relaxed">{result.answer}</p>
          </div>
          {result.sources.length > 0 && (
            <>
              <p className="text-xs text-slate-500 mb-3 uppercase tracking-widest">
                Based on {result.sources.length} matching review{result.sources.length !== 1 ? 's' : ''}
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
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{fmtText(s.summary, 'No summary available')}</p>
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
  const [themeKey, setThemeKey] = useState<DashboardThemeKey>('light')

  useEffect(() => {
    const saved = window.localStorage.getItem('dashboard-theme') as DashboardThemeKey | null
    if (saved && saved in DASHBOARD_THEMES) setThemeKey(saved)
    else if (saved) window.localStorage.removeItem('dashboard-theme')
  }, [])

  const selectTheme = useCallback((nextTheme: DashboardThemeKey) => {
    setThemeKey(nextTheme)
    window.localStorage.setItem('dashboard-theme', nextTheme)
  }, [])

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
  const pendingFollowUps = recentReviews.filter((r) => r.sentiment !== 'positive' && r.status === 'pending').length
  const complaintRate = totalReviews ? Math.round((complaint / totalReviews) * 100) : 0
  const positiveRate = totalReviews ? Math.round((positive / totalReviews) * 100) : 0
  const bestShop = rankedShops.find((shop) => shop.total > 0)
  const lowestShop = [...shops]
    .filter((shop) => shop.total > 0)
    .sort((a, b) => (a.satisfaction ?? -1) - (b.satisfaction ?? -1))[0]

  const satisfactionColor = !satisfaction ? '#94a3b8'
    : satisfaction >= 70 ? '#22c55e' : satisfaction >= 45 ? '#eab308' : '#ef4444'
  const theme = DASHBOARD_THEMES[themeKey] ?? DASHBOARD_THEMES.light

  const tabBtn = (active: boolean) => `px-4 py-2.5 rounded-xl text-sm font-black transition-colors border ${
    active
      ? 'text-white border-transparent shadow-sm'
      : `bg-[var(--dash-input)] text-[var(--dash-text)] border-[var(--dash-border)] ${theme.tabHover}`
  }`

  return (
    <div
      className={`dash-dashboard min-h-dvh ${theme.bgClass} text-[var(--dash-text)] font-sans`}
      data-dashboard-theme={themeKey}
      style={theme.vars}
    >
      <div className="mx-auto w-full max-w-[1720px] px-4 py-5 sm:px-6 lg:px-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className={`${surfaceCls} mb-5 overflow-hidden rounded-2xl`} style={{ borderTop: `3px solid ${theme.accent}` }}>
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:p-6">
          <div className="min-w-0">
            <p className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
              Customer Experience Intelligence
            </p>
            <h1 className="max-w-4xl text-2xl font-black leading-tight text-[var(--dash-heading)] sm:text-3xl lg:text-4xl">
              Outlet performance and review analytics
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--dash-muted)]">
              Monitor complaint risk, satisfaction quality, and follow-up work across every shop.
            </p>
          </div>

          <div className="grid min-w-[min(100%,23rem)] grid-cols-3 gap-2">
            <div className={`rounded-xl border p-3 ${theme.statPanel}`}>
              <p className="text-[0.62rem] font-black uppercase tracking-widest opacity-75">Reviews</p>
              <p className="mt-1.5 text-xl font-black">{totalReviews}</p>
            </div>
            <div className={`rounded-xl border p-3 ${theme.positivePanel}`}>
              <p className="text-[0.62rem] font-black uppercase tracking-widest opacity-80">Positive</p>
              <p className="mt-1.5 text-xl font-black">{positiveRate}%</p>
            </div>
            <div className={`rounded-xl border p-3 ${theme.queuePanel}`}>
              <p className="text-[0.62rem] font-black uppercase tracking-widest opacity-80">Queue</p>
              <p className="mt-1.5 text-xl font-black">{pendingFollowUps}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--dash-border)] bg-[var(--dash-inset)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 lg:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button onClick={() => setTab('analytics')} className={tabBtn(tab === 'analytics')} style={tab === 'analytics' ? { background: theme.accentDark } : undefined}>
              Analytics
            </button>
            <button onClick={() => setTab('reviews')} className={tabBtn(tab === 'reviews')} style={tab === 'reviews' ? { background: theme.accentDark } : undefined}>
              Reviews
              {pendingFollowUps > 0 && (
                <span className="ml-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white">
                  {pendingFollowUps}
                </span>
              )}
            </button>
            <button onClick={() => setTab('shops')} className={tabBtn(tab === 'shops')} style={tab === 'shops' ? { background: theme.accentDark } : undefined}>
              Shops
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ThemeSelector selected={themeKey} onSelect={selectTheme} />
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold text-[var(--dash-muted)]">
              <span>Updated {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="hidden h-1 w-1 rounded-full bg-[var(--dash-border)] sm:block" />
              <span>SQLite demo data</span>
            </div>
            <button
              onClick={() => router.refresh()}
              className="w-fit rounded-full border border-[var(--dash-border)] bg-[var(--dash-input)] px-3 py-1.5 text-xs font-black text-[var(--dash-muted)] transition-colors hover:border-blue-300 hover:text-blue-500"
            >
              ↻ Refresh
            </button>
            <button
              onClick={async () => {
                await fetch('/api/dashboard/auth', { method: 'DELETE' })
                router.push('/dashboard/login')
              }}
              className="w-fit rounded-full border border-[var(--dash-border)] bg-[var(--dash-input)] px-3 py-1.5 text-xs font-black text-[var(--dash-muted)] transition-colors hover:border-red-300 hover:text-red-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      {tab === 'analytics' && (
        <>
          {/* ── AI Search ───────────────────────────────────────────────── */}
          <SearchPanel />

          {/* ── Executive KPIs ──────────────────────────────────────────── */}
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <SectionTitle>Executive Summary</SectionTitle>
              <h2 className="text-xl font-black text-[var(--dash-heading)]">Business health snapshot</h2>
            </div>
            <p className="max-w-2xl text-xs font-semibold leading-5 text-[var(--dash-muted)]">
              The cards below separate volume, customer sentiment, and operational risk for faster management review.
            </p>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
            <KpiCard label="Total"       value={totalReviews} color={theme.accent} highlight />
            <KpiCard label="Positive"     value={positive}
              sub={`${totalReviews ? Math.round(positive / totalReviews * 100) : 0}%`}
              color="#22c55e" />
            <KpiCard label="Negative"    value={negative}
              sub={`${totalReviews ? Math.round(negative / totalReviews * 100) : 0}%`}
              color="#f97316" />
            <KpiCard label="Complaints"  value={complaint}
              sub={`${totalReviews ? Math.round(complaint / totalReviews * 100) : 0}%`}
              color="#ef4444" />
            <KpiCard label="Suggestions" value={suggestion}
              sub={`${totalReviews ? Math.round(suggestion / totalReviews * 100) : 0}%`}
              color={theme.accent} />
            <KpiCard label="Avg Rating"
              value={avgRating !== null ? `${avgRating}/5` : '—'}
              color="#eab308" />
            <KpiCard label="Satisfaction"
              value={satisfaction !== null ? `${satisfaction}%` : '—'}
              color={satisfactionColor} />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InsightCard
              label="Complaint Rate"
              value={`${complaintRate}%`}
              detail={complaintRate >= 20 ? 'Needs active management' : 'Within current tolerance'}
              tone={complaintRate >= 20 ? 'red' : 'green'}
            />
            <InsightCard
              label="Follow-up Queue"
              value={pendingFollowUps}
              detail={pendingFollowUps === 0 ? 'No open recovery work' : 'Open customer recovery items'}
              tone={pendingFollowUps > 0 ? 'amber' : 'green'}
            />
            <InsightCard
              label="Strongest Outlet"
              value={bestShop?.name ?? '—'}
              detail={bestShop?.satisfaction !== null && bestShop?.satisfaction !== undefined ? `${bestShop.satisfaction}% satisfaction` : 'No rated outlet yet'}
              tone="blue"
            />
            <InsightCard
              label="Lowest Rated"
              value={lowestShop?.name ?? '—'}
              detail={lowestShop?.satisfaction !== null && lowestShop?.satisfaction !== undefined ? `${lowestShop.satisfaction}% satisfaction` : 'No rated outlet yet'}
              tone={lowestShop && (lowestShop.satisfaction ?? 100) < 60 ? 'red' : 'slate'}
            />
          </div>

          <Divider />

          {/* ── Sentiment + Category ────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">

            {/* Sentiment Analysis */}
            <Card>
              <SectionTitle>Sentiment Breakdown</SectionTitle>
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
              <SectionTitle>Category Breakdown</SectionTitle>
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
          <SectionTitle>Outlet Performance</SectionTitle>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">
            {rankedShops.map((shop, i) => <ShopCard key={shop.id} shop={shop} rank={i + 1} />)}
          </div>

          <Divider />

          {/* ── Top Issues + Top Suggestions ────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-8">

            {/* Top Issues */}
            <Card>
              <SectionTitle>Top Issues Requiring Attention</SectionTitle>
              {topIssues.length === 0
                ? <p className="text-slate-500 text-sm">No critical issues found.</p>
                : (
                  <div className="space-y-2">
                    {topIssues.map((issue, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2.5 ${insetCls} rounded-lg`}>
                        <Dot color={issue.sentiment === 'complaint' ? '#ef4444' : '#f97316'} />
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
              <SectionTitle>Top Customer Suggestions</SectionTitle>
              {topSuggestions.length === 0
                ? <p className="text-slate-500 text-sm">No suggestions recorded yet</p>
                : (
                  <div className="space-y-2">
                    {topSuggestions.map((s, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2.5 ${insetCls} rounded-lg`}>
                        <Dot color="#6366f1" />
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
              <SectionTitle>Monthly Review Trend</SectionTitle>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData} margin={{ left: 0, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="month" tick={{ fill: CHART_TICK, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_TICK, fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}
                    labelStyle={{ color: '#0f172a' }} />
                  <Line type="monotone" dataKey="count" stroke={theme.accent} strokeWidth={2.5}
                    dot={{ fill: theme.accent, r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Rating Distribution */}
            <Card>
              <SectionTitle>Rating Distribution</SectionTitle>
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
                  <span className="text-lg font-bold text-yellow-500">{avgRating} / 5</span>
                </div>
              )}
            </Card>
          </div>

          {/* ── Recent Reviews (preview, click to see all) ──────────────── */}
          <Card className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Recent Reviews</SectionTitle>
              <button onClick={() => setTab('reviews')}
                className="text-xs font-black hover:underline"
                style={{ color: theme.accent }}>
                View all →
              </button>
            </div>
            <ReviewsPanel reviews={recentReviews.slice(0, 6)} />
          </Card>

          <p className="text-center text-slate-700 text-xs mt-8">
            VoiceAgent · Customer Review Analytics · © {new Date().getFullYear()}
          </p>
        </>
      )}

      {tab === 'reviews' && (
        <Card>
          <SectionTitle>All Reviews — Follow-up Tracker</SectionTitle>
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
