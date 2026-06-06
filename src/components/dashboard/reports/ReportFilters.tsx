'use client'

import { useState, useEffect, useRef } from 'react'
import { PROVINCES, CITIES_BY_PROVINCE } from '@/data/pakistan-locations'

export interface ReportFilterState {
  dateFrom: string
  dateTo: string
  shopIds: string[]
  provinces: string[]
  cities: string[]
  categories: string[]
  sentiments: string[]
}

export interface ShopOption {
  id: string
  name: string
  city: string | null
}

interface Props {
  shops: ShopOption[]
  isAdmin: boolean
  onApply: (filters: ReportFilterState) => void
  loading: boolean
}

const ALL_CATEGORIES = ['product', 'service', 'behavioral', 'facility', 'pricing', 'general']
const ALL_SENTIMENTS = ['positive', 'negative', 'complaint', 'suggestion']

const CATEGORY_LABEL: Record<string, string> = {
  product: 'Product', service: 'Service', behavioral: 'Behavioral',
  facility: 'Facility', pricing: 'Pricing', general: 'General',
}
const SENTIMENT_LABEL: Record<string, string> = {
  positive: 'Positive', negative: 'Negative', complaint: 'Complaint', suggestion: 'Suggestion',
}
const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#22c55e', negative: '#f97316', complaint: '#ef4444', suggestion: '#6366f1',
}
const CATEGORY_COLOR: Record<string, string> = {
  product: '#0891b2', service: '#7c3aed', behavioral: '#db2777',
  facility: '#d97706', pricing: '#16a34a', general: '#64748b',
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function offsetDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function startOfQuarter(offset = 0) {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3) - offset
  const year = d.getFullYear() + (q < 0 ? -1 : 0)
  const adjQ = ((q % 4) + 4) % 4
  return new Date(year, adjQ * 3, 1).toISOString().slice(0, 10)
}
function endOfQuarter(offset = 0) {
  const d = new Date()
  const q = Math.floor(d.getMonth() / 3) - offset
  const year = d.getFullYear() + (q < 0 ? -1 : 0)
  const adjQ = ((q % 4) + 4) % 4
  return new Date(year, adjQ * 3 + 3, 0).toISOString().slice(0, 10)
}

const DATE_PRESETS = [
  {
    label: 'This Week',
    from: () => offsetDays(6),
    to: todayISO,
  },
  {
    label: 'This Month',
    from: () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: todayISO,
  },
  {
    label: 'This Quarter',
    from: () => startOfQuarter(0),
    to: () => endOfQuarter(0),
  },
  {
    label: 'Last Quarter',
    from: () => startOfQuarter(1),
    to: () => endOfQuarter(1),
  },
  {
    label: 'YTD',
    from: () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    to: todayISO,
  },
  {
    label: 'All Time',
    from: () => '',
    to: () => '',
  },
]

function defaultFilters(): ReportFilterState {
  return {
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    dateTo:   todayISO(),
    shopIds:  [],
    provinces: [],
    cities:   [],
    categories: [],
    sentiments: [],
  }
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────
function MultiDropdown({
  label,
  options,
  selected,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onChange: (v: string[]) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
  const displayText = selected.length === 0
    ? (placeholder ?? `All ${label}`)
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
      : `${selected.length} selected`

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div ref={ref} className="relative min-w-0">
      <p className="mb-1 text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">{label}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
          disabled
            ? 'cursor-not-allowed opacity-50 bg-[var(--dash-inset)] border-[var(--dash-border)]'
            : 'bg-[var(--dash-input)] border-[var(--dash-input-border)] text-[var(--dash-text)] hover:border-[var(--dash-accent)]'
        }`}
      >
        <span className={`truncate ${selected.length > 0 ? 'text-[var(--dash-accent)]' : 'text-[var(--dash-muted)]'}`}>
          {displayText}
        </span>
        <svg className={`h-4 w-4 shrink-0 text-[var(--dash-muted)] transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[180px] rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-lg">
          {options.length > 6 && (
            <div className="p-2 border-b border-[var(--dash-border)]">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input)] px-3 py-1.5 text-xs text-[var(--dash-text)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
              />
            </div>
          )}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-[var(--dash-muted)]">No results</p>
            )}
            {filtered.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-[var(--dash-inset)] transition-colors">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggle(opt.value)}
                  className="h-3.5 w-3.5 rounded accent-[var(--dash-accent)]"
                />
                <span className="text-xs font-semibold text-[var(--dash-text)]">{opt.label}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-[var(--dash-border)] p-2">
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false) }}
                className="w-full rounded-lg px-2 py-1 text-xs font-black text-[var(--dash-muted)] hover:text-red-500 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Toggle pill ───────────────────────────────────────────────────────────────
function TogglePill({
  label,
  active,
  color,
  onClick,
}: {
  label: string
  active: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-black transition-colors ${
        active
          ? 'border-transparent text-white shadow-sm'
          : 'bg-[var(--dash-input)] border-[var(--dash-border)] text-[var(--dash-muted)] hover:border-slate-400'
      }`}
      style={active ? { background: color } : undefined}
    >
      {label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ReportFilters({ shops, isAdmin, onApply, loading }: Props) {
  const [filters, setFilters] = useState<ReportFilterState>(defaultFilters())
  const [activePreset, setActivePreset] = useState<string>('This Month')

  function applyPreset(preset: typeof DATE_PRESETS[0]) {
    setActivePreset(preset.label)
    setFilters((f) => ({ ...f, dateFrom: preset.from(), dateTo: preset.to() }))
  }

  // Cascade: when provinces change, clear cities that no longer match
  const allowedCities = filters.provinces.length
    ? filters.provinces.flatMap((p) => CITIES_BY_PROVINCE[p] ?? [])
    : Object.values(CITIES_BY_PROVINCE).flat()

  useEffect(() => {
    setFilters((f) => ({
      ...f,
      cities: f.cities.filter((c) => allowedCities.includes(c)),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.provinces.join(',')])

  function togglePill(key: keyof Pick<ReportFilterState, 'categories' | 'sentiments'>, value: string) {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((v) => v !== value)
        : [...f[key], value],
    }))
    setActivePreset('')
  }

  function handleDateChange(field: 'dateFrom' | 'dateTo', value: string) {
    setFilters((f) => ({ ...f, [field]: value }))
    setActivePreset('')
  }

  function handleReset() {
    const d = defaultFilters()
    setFilters(d)
    setActivePreset('This Month')
    onApply(d)
  }

  const provinceOptions = PROVINCES.map((p) => ({ value: p, label: p }))
  const cityOptions     = allowedCities.map((c) => ({ value: c, label: c }))
  const shopOptions     = shops.map((s) => ({
    value: s.id,
    label: s.city ? `${s.name} — ${s.city}` : s.name,
  }))

  return (
    <div className="mb-5 rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-surface)] shadow-[0_8px_32px_var(--dash-shadow)] overflow-hidden">
      <div className="border-b border-[var(--dash-border)] px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Management Report</p>
          <h2 className="text-base font-black text-[var(--dash-heading)]">Filter & Analyze</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-[var(--dash-border)] bg-[var(--dash-input)] px-3 py-1.5 text-xs font-black text-[var(--dash-muted)] transition-colors hover:border-red-300 hover:text-red-500"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onApply(filters)}
            className="rounded-full px-4 py-1.5 text-xs font-black text-white shadow-sm transition-opacity disabled:opacity-60"
            style={{ background: 'var(--dash-accent)' }}
          >
            {loading ? 'Loading…' : 'Apply Filters'}
          </button>
        </div>
      </div>

      <div className="p-5 grid gap-5">
        {/* ── Date row ─────────────────────────────────────────────────────── */}
        <div>
          <p className="mb-2 text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Date Range</p>
          <div className="flex flex-wrap items-center gap-2">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`rounded-full border px-3 py-1 text-xs font-black transition-colors ${
                  activePreset === preset.label
                    ? 'border-transparent text-white shadow-sm'
                    : 'bg-[var(--dash-input)] border-[var(--dash-border)] text-[var(--dash-muted)] hover:border-slate-400'
                }`}
                style={activePreset === preset.label ? { background: 'var(--dash-accent)' } : undefined}
              >
                {preset.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-2">
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleDateChange('dateFrom', e.target.value)}
                className="rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input)] px-3 py-1.5 text-xs font-semibold text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
              />
              <span className="text-xs text-[var(--dash-muted)] font-bold">to</span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleDateChange('dateTo', e.target.value)}
                className="rounded-lg border border-[var(--dash-input-border)] bg-[var(--dash-input)] px-3 py-1.5 text-xs font-semibold text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-accent)]"
              />
            </div>
          </div>
        </div>

        {/* ── Geographic + shop row ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MultiDropdown
            label="Province"
            options={provinceOptions}
            selected={filters.provinces}
            onChange={(v) => { setFilters((f) => ({ ...f, provinces: v })); setActivePreset('') }}
            placeholder="All Provinces"
          />
          <MultiDropdown
            label="City"
            options={cityOptions}
            selected={filters.cities}
            onChange={(v) => { setFilters((f) => ({ ...f, cities: v })); setActivePreset('') }}
            placeholder="All Cities"
            disabled={cityOptions.length === 0}
          />
          {isAdmin && (
            <MultiDropdown
              label="Outlet"
              options={shopOptions}
              selected={filters.shopIds}
              onChange={(v) => { setFilters((f) => ({ ...f, shopIds: v })); setActivePreset('') }}
              placeholder="All Outlets"
            />
          )}
        </div>

        {/* ── Category + Sentiment pills ────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Category</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_CATEGORIES.map((cat) => (
                <TogglePill
                  key={cat}
                  label={CATEGORY_LABEL[cat]}
                  active={filters.categories.includes(cat)}
                  color={CATEGORY_COLOR[cat]}
                  onClick={() => togglePill('categories', cat)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">Sentiment</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SENTIMENTS.map((s) => (
                <TogglePill
                  key={s}
                  label={SENTIMENT_LABEL[s]}
                  active={filters.sentiments.includes(s)}
                  color={SENTIMENT_COLOR[s]}
                  onClick={() => togglePill('sentiments', s)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
