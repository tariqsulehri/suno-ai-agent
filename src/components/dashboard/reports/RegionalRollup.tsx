'use client'

import { useState } from 'react'
import type { RegionalNode } from '@/lib/db/report-query'

const SENTIMENT_COLOR: Record<string, string> = {
  positive: '#22c55e', negative: '#f97316', complaint: '#ef4444', suggestion: '#6366f1',
}

function satisfactionColor(pct: number | null): string {
  if (pct === null) return '#94a3b8'
  if (pct >= 70)   return '#22c55e'
  if (pct >= 40)   return '#eab308'
  return '#ef4444'
}

function SatisfactionBadge({ pct }: { pct: number | null }) {
  const color = satisfactionColor(pct)
  if (pct === null) return <span className="text-xs text-[var(--dash-muted)]">—</span>
  return (
    <span className="text-xs font-black" style={{ color }}>{pct}%</span>
  )
}

function SentimentMiniBar({
  positive, negative, complaint, suggestion, total,
}: {
  positive: number; negative: number; complaint: number; suggestion: number; total: number
}) {
  if (total === 0) return null
  const segments = [
    { key: 'positive', value: positive, color: SENTIMENT_COLOR.positive },
    { key: 'negative', value: negative, color: SENTIMENT_COLOR.negative },
    { key: 'complaint', value: complaint, color: SENTIMENT_COLOR.complaint },
    { key: 'suggestion', value: suggestion, color: SENTIMENT_COLOR.suggestion },
  ].filter((s) => s.value > 0)

  return (
    <div className="flex h-1.5 w-24 rounded-full overflow-hidden gap-px">
      {segments.map((s) => (
        <div
          key={s.key}
          className="h-full"
          style={{ width: `${Math.round((s.value / total) * 100)}%`, background: s.color }}
          title={`${s.key}: ${s.value}`}
        />
      ))}
    </div>
  )
}

interface NodeRowProps {
  node: RegionalNode
  depth: number
  defaultOpen?: boolean
}

function NodeRow({ node, depth, defaultOpen = false }: NodeRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const hasChildren = node.children && node.children.length > 0
  const isLeaf = node.type === 'shop'

  const indentPx = depth * 20

  return (
    <>
      <tr
        className={`border-b border-[var(--dash-border)] transition-colors ${
          isLeaf ? '' : 'cursor-pointer hover:bg-[var(--dash-inset)]'
        } ${node.type === 'province' ? 'bg-[var(--dash-inset)]' : ''}`}
        onClick={() => !isLeaf && hasChildren && setOpen((o) => !o)}
      >
        {/* Name */}
        <td className="px-3 py-3" style={{ paddingLeft: `${12 + indentPx}px` }}>
          <div className="flex items-center gap-2">
            {!isLeaf && hasChildren && (
              <span className="text-[0.65rem] text-[var(--dash-muted)] w-3 shrink-0">
                {open ? '▼' : '▶'}
              </span>
            )}
            {isLeaf && <span className="w-3 shrink-0" />}
            <div>
              <p className={`font-black leading-tight text-[var(--dash-heading)] ${
                node.type === 'province' ? 'text-sm' : node.type === 'city' ? 'text-xs' : 'text-xs'
              }`}>
                {node.name}
              </p>
              <p className="text-[0.62rem] text-[var(--dash-muted)] mt-0.5 capitalize">{node.type}</p>
            </div>
          </div>
        </td>

        {/* Total */}
        <td className="px-3 py-3 text-center">
          <span className={`font-black text-[var(--dash-heading)] ${node.type === 'province' ? 'text-sm' : 'text-xs'}`}>
            {node.total}
          </span>
        </td>

        {/* Satisfaction */}
        <td className="px-3 py-3 text-center">
          <SatisfactionBadge pct={node.satisfaction} />
        </td>

        {/* Avg Rating */}
        <td className="px-3 py-3 text-center">
          <span className="text-xs font-bold text-amber-600">
            {node.avgRating !== null ? `${node.avgRating}★` : '—'}
          </span>
        </td>

        {/* Sentiment bar */}
        <td className="px-3 py-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <SentimentMiniBar
              positive={node.positive}
              negative={node.negative}
              complaint={node.complaint}
              suggestion={node.suggestion}
              total={node.total}
            />
            <p className="text-[0.6rem] text-[var(--dash-muted)]">
              <span style={{ color: SENTIMENT_COLOR.complaint }}>{node.complaint}C</span>
              {' · '}
              <span style={{ color: SENTIMENT_COLOR.negative }}>{node.negative}N</span>
              {' · '}
              <span style={{ color: SENTIMENT_COLOR.positive }}>{node.positive}P</span>
            </p>
          </div>
        </td>
      </tr>

      {open && hasChildren && node.children!.map((child) => (
        <NodeRow key={child.shopId ?? `${child.type}-${child.name}`} node={child} depth={depth + 1} />
      ))}
    </>
  )
}

interface Props {
  nodes: RegionalNode[]
}

export function RegionalRollup({ nodes }: Props) {
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">🗺️</div>
        <p className="text-sm font-bold text-[var(--dash-muted)]">No regional data. Shops may be missing Province/City info.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-[var(--dash-border)] bg-[var(--dash-inset)]">
            <th className="px-3 py-2 text-left text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
              Region / Outlet
            </th>
            <th className="px-3 py-2 text-center text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
              Reviews
            </th>
            <th className="px-3 py-2 text-center text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
              Satisfaction
            </th>
            <th className="px-3 py-2 text-center text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
              Avg Rating
            </th>
            <th className="px-3 py-2 text-center text-[0.62rem] font-black uppercase tracking-widest text-[var(--dash-muted)]">
              Sentiment Split
            </th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <NodeRow
              key={node.name}
              node={node}
              depth={0}
              defaultOpen={nodes.length <= 3}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
