'use client'

import { useState } from 'react'
import type { ShopReportRow } from '@/lib/db/report-query'

const CATEGORIES = ['product', 'service', 'behavioral', 'facility', 'pricing', 'general']
const CATEGORY_LABEL: Record<string, string> = {
  product: 'Product', service: 'Service', behavioral: 'Behavioral',
  facility: 'Facility', pricing: 'Pricing', general: 'General',
}
const CATEGORY_COLOR: Record<string, string> = {
  product: '#0891b2', service: '#7c3aed', behavioral: '#db2777',
  facility: '#d97706', pricing: '#16a34a', general: '#64748b',
}
const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#22c55e', negative: '#f97316', complaint: '#ef4444', suggestion: '#6366f1',
}

type SortKey = 'name' | 'total' | 'satisfaction' | 'avgRating' | 'complaint' | 'negative' | 'positive' | 'suggestion' | 'pendingFollowUps'

function satisfactionClass(pct: number | null): string {
  if (pct === null) return 'text-[var(--dash-muted)]'
  if (pct >= 70)   return 'text-emerald-600 font-black'
  if (pct >= 40)   return 'text-amber-600 font-black'
  return 'text-red-600 font-black'
}

function satisfactionBg(pct: number | null): string {
  if (pct === null) return 'bg-slate-100'
  if (pct >= 70)   return 'bg-emerald-500'
  if (pct >= 40)   return 'bg-amber-500'
  return 'bg-red-500'
}

function SortIcon({ active, asc }: { active: boolean; asc: boolean }) {
  if (!active) return <span className="ml-1 text-slate-300">↕</span>
  return <span className="ml-1" style={{ color: 'var(--dash-accent)' }}>{asc ? '↑' : '↓'}</span>
}

interface Props {
  rows: ShopReportRow[]
}

export function ShopComparisonTable({ rows }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>('satisfaction')
  const [sortAsc, setSortAsc]   = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const sorted = [...rows].sort((a, b) => {
    let av: number | string = 0
    let bv: number | string = 0
    if (sortKey === 'name') {
      av = a.name.toLowerCase(); bv = b.name.toLowerCase()
      return sortAsc ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1)
    }
    if (sortKey === 'satisfaction') { av = a.satisfaction ?? -1; bv = b.satisfaction ?? -1 }
    if (sortKey === 'avgRating')    { av = a.avgRating ?? -1;    bv = b.avgRating ?? -1 }
    if (sortKey === 'total')        { av = a.total;               bv = b.total }
    if (sortKey === 'positive')     { av = a.positive;            bv = b.positive }
    if (sortKey === 'negative')     { av = a.negative;            bv = b.negative }
    if (sortKey === 'complaint')    { av = a.complaint;           bv = b.complaint }
    if (sortKey === 'suggestion')   { av = a.suggestion;          bv = b.suggestion }
    if (sortKey === 'pendingFollowUps') { av = a.pendingFollowUps; bv = b.pendingFollowUps }
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function Th({ label, col }: { label: string; col: SortKey }) {
    return (
      <th
        className="cursor-pointer whitespace-nowrap px-3 py-2 text-left text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)] hover:text-[var(--dash-accent)] select-none"
        onClick={() => handleSort(col)}
      >
        {label}<SortIcon active={sortKey === col} asc={sortAsc} />
      </th>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-sm font-bold text-[var(--dash-muted)]">No shops match the current filters.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--dash-border)] bg-[var(--dash-inset)]">
            <th className="w-6 px-3 py-2" />
            <Th label="Outlet"           col="name" />
            <Th label="Total"            col="total" />
            <Th label="Satisfaction"     col="satisfaction" />
            <Th label="Avg Rating"       col="avgRating" />
            <Th label="Positive"         col="positive" />
            <Th label="Negative"         col="negative" />
            <Th label="Complaint"        col="complaint" />
            <Th label="Suggestion"       col="suggestion" />
            <Th label="Pending"          col="pendingFollowUps" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const isExpanded = expanded.has(row.id)
            return (
              <>
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-[var(--dash-border)] transition-colors hover:bg-[var(--dash-inset)] ${
                    i % 2 === 0 ? '' : 'bg-[var(--dash-inset)]/40'
                  }`}
                  onClick={() => toggleExpand(row.id)}
                >
                  <td className="px-3 py-3 text-[var(--dash-muted)] text-xs">
                    {isExpanded ? '▼' : '▶'}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-black text-[var(--dash-heading)] leading-tight">{row.name}</p>
                    {row.city && <p className="text-[0.68rem] text-[var(--dash-muted)] mt-0.5">{row.city}{row.province ? `, ${row.province}` : ''}</p>}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-[var(--dash-text)]">{row.total}</td>
                  <td className="px-3 py-3 text-center">
                    {row.satisfaction !== null ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className={satisfactionClass(row.satisfaction)}>{row.satisfaction}%</span>
                        <div className="h-1.5 w-16 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${satisfactionBg(row.satisfaction)}`}
                            style={{ width: `${row.satisfaction}%` }}
                          />
                        </div>
                      </div>
                    ) : <span className="text-[var(--dash-muted)]">—</span>}
                  </td>
                  <td className="px-3 py-3 text-center font-bold text-amber-600">
                    {row.avgRating !== null ? `${row.avgRating}★` : '—'}
                  </td>
                  <td className="px-3 py-3 text-center font-bold" style={{ color: SENTIMENT_COLOR.positive }}>{row.positive}</td>
                  <td className="px-3 py-3 text-center font-bold" style={{ color: SENTIMENT_COLOR.negative }}>{row.negative}</td>
                  <td className="px-3 py-3 text-center font-bold" style={{ color: SENTIMENT_COLOR.complaint }}>{row.complaint}</td>
                  <td className="px-3 py-3 text-center font-bold" style={{ color: SENTIMENT_COLOR.suggestion }}>{row.suggestion}</td>
                  <td className="px-3 py-3 text-center">
                    {row.pendingFollowUps > 0 ? (
                      <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white">
                        {row.pendingFollowUps}
                      </span>
                    ) : <span className="text-[var(--dash-muted)]">—</span>}
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${row.id}-expand`} className="border-b border-[var(--dash-border)] bg-[var(--dash-inset)]/60">
                    <td colSpan={10} className="px-6 py-4">
                      <p className="mb-3 text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
                        Category Breakdown — {row.name}
                      </p>
                      {Object.keys(row.categoryBreakdown).length === 0 ? (
                        <p className="text-xs text-[var(--dash-muted)]">No category data for this period.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                          {CATEGORIES.filter((c) => row.categoryBreakdown[c]).map((cat) => {
                            const d = row.categoryBreakdown[cat]
                            if (!d) return null
                            const issueRate = d.total ? Math.round(((d.negative + d.complaint) / d.total) * 100) : 0
                            return (
                              <div
                                key={cat}
                                className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] p-3"
                              >
                                <div className="flex items-center gap-1.5 mb-2">
                                  <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[cat] }} />
                                  <span className="text-[0.62rem] font-black uppercase tracking-wider text-[var(--dash-muted)]">
                                    {CATEGORY_LABEL[cat]}
                                  </span>
                                </div>
                                <p className="text-lg font-black text-[var(--dash-heading)]">{d.total}</p>
                                <div className="mt-1.5 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width:      `${d.total ? Math.round((d.positive / d.total) * 100) : 0}%`,
                                      background: SENTIMENT_COLOR.positive,
                                    }}
                                  />
                                </div>
                                <p className="mt-1 text-[0.65rem] text-[var(--dash-muted)]">
                                  {issueRate}% issues
                                </p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
