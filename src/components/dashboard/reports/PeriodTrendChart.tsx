'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import type { TrendSeries } from '@/lib/db/report-query'

type MetricKey = 'count' | 'satisfaction'
const METRIC_OPTIONS: Array<{ key: MetricKey; label: string }> = [
  { key: 'count',        label: 'Total Reviews' },
  { key: 'satisfaction', label: 'Satisfaction %' },
]

// Up to 8 distinct colors for multi-shop lines
const LINE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#65a30d',
]

interface TooltipPayload {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active, payload, label, metric,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  metric: MetricKey
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-lg p-3 min-w-[160px]">
      <p className="text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)] mb-2">{label}</p>
      {payload.map((p: TooltipPayload) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--dash-text)]">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-xs font-black" style={{ color: p.color }}>
            {metric === 'satisfaction' ? `${p.value}%` : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  series: TrendSeries[]
}

export function PeriodTrendChart({ series }: Props) {
  const [metric, setMetric] = useState<MetricKey>('count')

  if (series.length === 0 || series.every((s) => s.data.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">📈</div>
        <p className="text-sm font-bold text-[var(--dash-muted)]">No trend data for the selected period.</p>
      </div>
    )
  }

  // Show at most 8 shops (top by total review volume)
  const topSeries = [...series]
    .sort((a, b) => b.data.reduce((s, d) => s + d.count, 0) - a.data.reduce((s, d) => s + d.count, 0))
    .slice(0, 8)

  // Build chart data — one row per period
  const allPeriods = [...new Set(topSeries.flatMap((s) => s.data.map((d) => d.period)))].sort()

  const chartData = allPeriods.map((period) => {
    const row: Record<string, string | number> = { period }
    for (const s of topSeries) {
      const point = s.data.find((d) => d.period === period)
      if (metric === 'count')        row[s.shopName] = point?.count        ?? 0
      if (metric === 'satisfaction') row[s.shopName] = point?.satisfaction ?? 0
    }
    return row
  })

  // Format period label (YYYY-MM → "Jan '24", YYYY-W01 → "W01 '24")
  function fmtPeriod(p: string): string {
    if (p.includes('-W')) {
      const [year, week] = p.split('-W')
      return `W${week} '${year?.slice(2)}`
    }
    const [year, month] = p.split('-')
    if (!year || !month) return p
    const date = new Date(parseInt(year), parseInt(month) - 1, 1)
    return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  }

  return (
    <div>
      {/* ── Metric toggle ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {METRIC_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMetric(opt.key)}
            className={`rounded-full border px-3 py-1 text-xs font-black transition-colors ${
              metric === opt.key
                ? 'border-transparent text-white shadow-sm'
                : 'bg-[var(--dash-input)] border-[var(--dash-border)] text-[var(--dash-muted)] hover:border-slate-400'
            }`}
            style={metric === opt.key ? { background: 'var(--dash-accent)' } : undefined}
          >
            {opt.label}
          </button>
        ))}
        {series.length > 8 && (
          <span className="text-[0.68rem] text-[var(--dash-muted)] ml-2">
            Showing top 8 outlets by volume
          </span>
        )}
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────────────── */}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#e5eaf2" strokeDasharray="3 3" />
          <XAxis
            dataKey="period"
            tickFormatter={fmtPeriod}
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => metric === 'satisfaction' ? `${v}%` : String(v)}
          />
          <Tooltip
            content={<CustomTooltip metric={metric} />}
            labelFormatter={(label) => fmtPeriod(String(label))}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
            formatter={(value) => <span style={{ color: 'var(--dash-text)', fontWeight: 700 }}>{value}</span>}
          />
          {topSeries.map((s, i) => (
            <Line
              key={s.shopId}
              type="monotone"
              dataKey={s.shopName}
              stroke={LINE_COLORS[i % LINE_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
