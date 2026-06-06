'use client'

import { useState } from 'react'
import type { HeatmapCell } from '@/lib/db/report-query'

const CATEGORIES = ['product', 'service', 'behavioral', 'facility', 'pricing', 'general']
const CATEGORY_LABEL: Record<string, string> = {
  product: 'Product', service: 'Service', behavioral: 'Behavioral',
  facility: 'Facility', pricing: 'Pricing', general: 'General',
}
const SENTIMENT_COLOR: Record<string, string> = {
  complaint: '#ef4444',
  negative:  '#f97316',
}

function cellBg(count: number, max: number): string {
  if (max === 0 || count === 0) return 'hsl(0, 0%, 97%)'
  const intensity = count / max
  // White (100%) → light orange (80%) → deep red (30%)
  const lightness = Math.round(100 - intensity * 62)
  const saturation = Math.round(intensity * 85)
  return `hsl(10, ${saturation}%, ${lightness}%)`
}

function cellText(count: number, max: number): string {
  if (max === 0 || count === 0) return 'text-slate-300'
  const intensity = count / max
  return intensity > 0.5 ? 'text-white' : 'text-slate-700'
}

interface DrillDown {
  cell: HeatmapCell
}

interface Props {
  cells: HeatmapCell[]
}

export function IssueHeatMap({ cells }: Props) {
  const [drill, setDrill] = useState<DrillDown | null>(null)

  if (cells.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-sm font-bold text-[var(--dash-muted)]">No complaints or negatives in the selected period.</p>
      </div>
    )
  }

  // Build shop × category matrix
  const shopIds = [...new Set(cells.map((c) => c.shopId))]
  const shopNames = Object.fromEntries(cells.map((c) => [c.shopId, c.shopName]))

  // Sort shops by total issue count (descending)
  const shopTotals = Object.fromEntries(
    shopIds.map((id) => [id, cells.filter((c) => c.shopId === id).reduce((s, c) => s + c.count, 0)])
  )
  const sortedShopIds = [...shopIds].sort((a, b) => (shopTotals[b] ?? 0) - (shopTotals[a] ?? 0))

  const cellMap = Object.fromEntries(
    cells.map((c) => [`${c.shopId}__${c.category}`, c])
  )

  const max = Math.max(...cells.map((c) => c.count), 1)

  return (
    <>
      <div className="overflow-x-auto rounded-xl">
        <table className="min-w-full border-collapse">
          <thead>
            <tr>
              <th className="min-w-[160px] px-3 py-2 text-left text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)] bg-[var(--dash-inset)] border border-[var(--dash-border)]">
                Outlet
              </th>
              {CATEGORIES.map((cat) => (
                <th
                  key={cat}
                  className="px-3 py-2 text-center text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)] bg-[var(--dash-inset)] border border-[var(--dash-border)]"
                >
                  {CATEGORY_LABEL[cat]}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)] bg-[var(--dash-inset)] border border-[var(--dash-border)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedShopIds.map((shopId) => (
              <tr key={shopId}>
                <td className="px-3 py-2 border border-[var(--dash-border)] bg-[var(--dash-surface)]">
                  <p className="text-xs font-black text-[var(--dash-heading)] leading-tight truncate max-w-[140px]">
                    {shopNames[shopId]}
                  </p>
                  <p className="text-[0.62rem] text-[var(--dash-muted)] mt-0.5">{shopTotals[shopId]} issues</p>
                </td>
                {CATEGORIES.map((cat) => {
                  const cell = cellMap[`${shopId}__${cat}`]
                  const count = cell?.count ?? 0
                  return (
                    <td
                      key={cat}
                      className={`border border-[var(--dash-border)] text-center cursor-pointer transition-transform hover:scale-[1.08] hover:shadow-md hover:z-10 relative ${
                        count === 0 ? 'cursor-default' : ''
                      }`}
                      style={{ background: cellBg(count, max) }}
                      onClick={() => count > 0 && cell && setDrill({ cell })}
                      title={count > 0 ? `${shopNames[shopId]} · ${CATEGORY_LABEL[cat]}: ${count} issues — click to drill down` : undefined}
                    >
                      <span className={`block py-3 px-2 text-sm font-black ${cellText(count, max)}`}>
                        {count > 0 ? count : ''}
                      </span>
                    </td>
                  )
                })}
                <td className="px-3 py-2 text-center border border-[var(--dash-border)] bg-[var(--dash-inset)]">
                  <span className="text-sm font-black text-[var(--dash-heading)]">{shopTotals[shopId]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Intensity:</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <div key={t} className="flex items-center gap-1">
            <span
              className="h-3 w-6 rounded"
              style={{ background: cellBg(Math.round(t * max), max) }}
            />
            {t === 0 && <span className="text-[0.6rem] text-[var(--dash-muted)]">0</span>}
            {t === 1 && <span className="text-[0.6rem] text-[var(--dash-muted)]">{max}</span>}
          </div>
        ))}
        <span className="ml-2 text-[0.6rem] text-[var(--dash-muted)]">Click a cell to drill down</span>
      </div>

      {/* ── Drill-down drawer ──────────────────────────────────────────────────── */}
      {drill && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          onClick={(e) => e.target === e.currentTarget && setDrill(null)}
          style={{ background: 'rgba(0,0,0,0.35)' }}
        >
          <div className="h-full w-full max-w-md overflow-y-auto bg-[var(--dash-surface)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-[var(--dash-border)] px-5 py-4">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
                  Drill-down
                </p>
                <h3 className="text-base font-black text-[var(--dash-heading)] leading-tight">
                  {drill.cell.shopName}
                </h3>
                <p className="text-sm font-bold text-[var(--dash-muted)]">
                  {CATEGORY_LABEL[drill.cell.category]} — {drill.cell.count} issues
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrill(null)}
                className="rounded-full border border-[var(--dash-border)] bg-[var(--dash-input)] p-2 text-[var(--dash-muted)] hover:text-red-500 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 p-5 space-y-6">
              {/* Top subcategories */}
              <div>
                <p className="mb-3 text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
                  Top Issues
                </p>
                {drill.cell.topSubcategories.length === 0 ? (
                  <p className="text-xs text-[var(--dash-muted)]">No subcategory data.</p>
                ) : (
                  <div className="space-y-2">
                    {drill.cell.topSubcategories.map((sub, i) => (
                      <div key={sub.subcategory} className="flex items-center gap-3">
                        <span className="h-5 w-5 rounded-full text-center text-[0.62rem] font-black leading-5 bg-[var(--dash-inset)] text-[var(--dash-muted)]">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-bold text-[var(--dash-text)] capitalize">{sub.subcategory}</span>
                            <span className="text-xs font-black text-red-600">{sub.count}</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-red-400"
                              style={{ width: `${Math.round((sub.count / drill.cell.count) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sample reviews */}
              {drill.cell.samples.length > 0 && (
                <div>
                  <p className="mb-3 text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
                    Recent Examples
                  </p>
                  <div className="space-y-3">
                    {drill.cell.samples.map((s, i) => (
                      <div key={i} className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-inset)] p-3">
                        {s.sentiment && (
                          <span
                            className="mb-1.5 inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-black text-white uppercase tracking-wider"
                            style={{ background: SENTIMENT_COLOR[s.sentiment] ?? '#94a3b8' }}
                          >
                            {s.sentiment}
                          </span>
                        )}
                        <p className="text-xs font-semibold text-[var(--dash-text)] leading-5">
                          {s.summary ?? 'No summary available.'}
                        </p>
                        <p className="mt-1 text-[0.62rem] text-[var(--dash-muted)]">
                          {new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
