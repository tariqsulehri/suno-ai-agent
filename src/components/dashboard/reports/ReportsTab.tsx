'use client'

import { useState, useCallback } from 'react'
import { ReportFilters, type ReportFilterState, type ShopOption } from './ReportFilters'
import { ShopComparisonTable } from './ShopComparisonTable'
import { IssueHeatMap } from './IssueHeatMap'
import { PeriodTrendChart } from './PeriodTrendChart'
import { RegionalRollup } from './RegionalRollup'
import type { ShopReport } from '@/lib/db/report-query'

type ViewKey = 'table' | 'trend' | 'heatmap' | 'regional'

const VIEWS: Array<{ key: ViewKey; label: string; icon: string }> = [
  { key: 'table',    label: 'Shop Comparison', icon: '📊' },
  { key: 'trend',    label: 'Period Trend',     icon: '📈' },
  { key: 'heatmap',  label: 'Issue Heat Map',   icon: '🔥' },
  { key: 'regional', label: 'Regional Rollup',  icon: '🗺️' },
]

interface Props {
  shops: ShopOption[]
  isAdmin: boolean
}

function buildQueryString(filters: ReportFilterState): string {
  const params = new URLSearchParams()
  if (filters.dateFrom)         params.set('dateFrom',   filters.dateFrom)
  if (filters.dateTo)           params.set('dateTo',     filters.dateTo)
  if (filters.shopIds.length)   params.set('shopIds',    filters.shopIds.join(','))
  if (filters.provinces.length) params.set('provinces',  filters.provinces.join(','))
  if (filters.cities.length)    params.set('cities',     filters.cities.join(','))
  if (filters.categories.length) params.set('categories', filters.categories.join(','))
  if (filters.sentiments.length) params.set('sentiments', filters.sentiments.join(','))
  return params.toString()
}

function downloadCsv(data: ShopReport, filters: ReportFilterState) {
  const headers = [
    'Outlet', 'City', 'Province', 'Total Reviews',
    'Satisfaction %', 'Avg Rating',
    'Positive', 'Negative', 'Complaints', 'Suggestions',
    'Pending Follow-ups', 'Date From', 'Date To',
  ]
  const rows = data.shops.map((s) => [
    s.name,
    s.city ?? '',
    s.province ?? '',
    s.total,
    s.satisfaction ?? '',
    s.avgRating ?? '',
    s.positive,
    s.negative,
    s.complaint,
    s.suggestion,
    s.pendingFollowUps,
    filters.dateFrom || 'All time',
    filters.dateTo   || 'All time',
  ])

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => {
        const str = String(cell)
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    )
    .join('\n')

  const blob   = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const from   = filters.dateFrom || 'all'
  const to     = filters.dateTo   || 'time'
  anchor.href     = url
  anchor.download = `shop-report_${from}_${to}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function ReportsTab({ shops, isAdmin }: Props) {
  const [activeView, setActiveView] = useState<ViewKey>('table')
  const [reportData, setReportData] = useState<ShopReport | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [lastFilters, setLastFilters] = useState<ReportFilterState | null>(null)

  const handleApply = useCallback(async (filters: ReportFilterState) => {
    setLoading(true)
    setError(null)
    setLastFilters(filters)
    try {
      const qs  = buildQueryString(filters)
      const res = await fetch(`/api/dashboard/report?${qs}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as ShopReport
      setReportData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [])

  const surfaceCls = 'bg-[var(--dash-surface)] border border-[var(--dash-border)] shadow-[0_18px_50px_var(--dash-shadow)]'

  return (
    <div>
      <ReportFilters shops={shops} isAdmin={isAdmin} onApply={handleApply} loading={loading} />

      {/* ── Not yet loaded ─────────────────────────────────────────────────────── */}
      {!reportData && !loading && !error && (
        <div className={`${surfaceCls} flex flex-col items-center justify-center rounded-2xl py-20 text-center`}>
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-lg font-black text-[var(--dash-heading)]">Configure your report</p>
          <p className="mt-1 text-sm font-semibold text-[var(--dash-muted)]">
            Select filters above and click <strong>Apply Filters</strong> to generate the management report.
          </p>
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────────── */}
      {loading && (
        <div className={`${surfaceCls} flex flex-col items-center justify-center rounded-2xl py-20 text-center`}>
          <div className="text-5xl mb-4 animate-pulse">⚙️</div>
          <p className="text-base font-black text-[var(--dash-heading)]">Building report…</p>
          <p className="mt-1 text-sm font-semibold text-[var(--dash-muted)]">Running analytics across all outlets</p>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-black text-red-700">Error loading report: {error}</p>
          <button
            type="button"
            onClick={() => lastFilters && handleApply(lastFilters)}
            className="mt-3 rounded-full bg-red-600 px-4 py-1.5 text-xs font-black text-white hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Report ────────────────────────────────────────────────────────────── */}
      {reportData && !loading && (
        <>
          {/* ── Meta summary ──────────────────────────────────────────────────── */}
          <div className={`${surfaceCls} mb-4 rounded-2xl p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-[0.6rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Total Reviews</p>
                  <p className="text-xl font-black text-[var(--dash-heading)]">{reportData.meta.totalReviews}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Outlets</p>
                  <p className="text-xl font-black text-[var(--dash-heading)]">{reportData.meta.shopCount}</p>
                </div>
                <div>
                  <p className="text-[0.6rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Period</p>
                  <p className="text-sm font-black text-[var(--dash-heading)]">
                    {reportData.meta.dateFrom
                      ? `${reportData.meta.dateFrom} → ${reportData.meta.dateTo ?? 'today'}`
                      : 'All time'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => lastFilters && downloadCsv(reportData, lastFilters)}
                className="flex items-center gap-2 rounded-full border border-[var(--dash-border)] bg-[var(--dash-input)] px-4 py-2 text-xs font-black text-[var(--dash-text)] hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>

          {/* ── View switcher ──────────────────────────────────────────────────── */}
          <div className={`${surfaceCls} mb-5 rounded-2xl overflow-hidden`}>
            <div className="flex gap-1 border-b border-[var(--dash-border)] bg-[var(--dash-inset)] px-4 py-2.5">
              {VIEWS.map((view) => (
                <button
                  key={view.key}
                  type="button"
                  onClick={() => setActiveView(view.key)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black transition-colors ${
                    activeView === view.key
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-[var(--dash-input)] text-[var(--dash-text)] border-[var(--dash-border)] hover:border-slate-400'
                  }`}
                  style={activeView === view.key ? { background: 'var(--dash-accent)' } : undefined}
                >
                  <span>{view.icon}</span>
                  <span className="hidden sm:inline">{view.label}</span>
                </button>
              ))}
            </div>

            <div className="p-4 lg:p-5">
              {activeView === 'table'    && <ShopComparisonTable rows={reportData.shops} />}
              {activeView === 'trend'    && <PeriodTrendChart    series={reportData.trend} />}
              {activeView === 'heatmap'  && <IssueHeatMap        cells={reportData.heatmap} />}
              {activeView === 'regional' && <RegionalRollup      nodes={reportData.regional} />}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
