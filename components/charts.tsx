'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { fmtDate } from '@/lib/dates'
import { naira, nairaCompact } from '@/lib/format'

export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a'] as const
const GRID = '#ebe8e1'
const AXIS = { fontSize: 11, fill: '#8a867b' }

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

function TooltipCard({ title, rows, footer }: { title: string; rows: { label: string; value: string; color?: string }[]; footer?: { label: string; value: string } }) {
  return (
    <div className="min-w-44 rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-[0_8px_24px_-12px_rgba(27,26,23,0.35)]">
      <div className="mb-1.5 font-medium text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 py-0.5">
          {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}
          <span className="text-ink-2">{r.label}</span>
          <span className="num ml-auto pl-4 text-ink">{r.value}</span>
        </div>
      ))}
      {footer && (
        <div className="mt-1 flex justify-between border-t border-line pt-1 font-medium text-ink">
          <span>{footer.label}</span>
          <span className="num">{footer.value}</span>
        </div>
      )}
    </div>
  )
}

export interface RevenuePoint {
  date: string
  rooms: number
  fnb: number
  other: number
}

/** Stacked daily revenue: Rooms, F&B, Other. */
export function RevenueChart({ data, height = 240 }: { data: RevenuePoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, 'd MMM')} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
        <YAxis tickFormatter={(v) => nairaCompact(v)} tick={AXIS} tickLine={false} axisLine={false} width={52} />
        <Tooltip
          cursor={{ fill: 'rgba(30,74,65,0.05)' }}
          content={(p: TooltipContentProps<ValueType, NameType>) => {
            if (!p.active || !p.payload?.length) return null
            const d = p.payload[0].payload as RevenuePoint
            return (
              <TooltipCard
                title={fmtDate(d.date, 'EEEE d MMM')}
                rows={[
                  { label: 'Rooms', value: naira(d.rooms), color: SERIES[0] },
                  { label: 'Food & beverage', value: naira(d.fnb), color: SERIES[1] },
                  { label: 'Other', value: naira(d.other), color: SERIES[2] },
                ]}
                footer={{ label: 'Total', value: naira(d.rooms + d.fnb + d.other) }}
              />
            )
          }}
        />
        <Bar dataKey="rooms" stackId="r" fill={SERIES[0]} stroke="#fff" strokeWidth={1} maxBarSize={24} />
        <Bar dataKey="fnb" stackId="r" fill={SERIES[1]} stroke="#fff" strokeWidth={1} maxBarSize={24} />
        <Bar dataKey="other" stackId="r" fill={SERIES[2]} stroke="#fff" strokeWidth={1} maxBarSize={24} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Single-series trend with a light area wash. */
export function TrendChart({
  data,
  format,
  label,
  color = SERIES[0],
  height = 200,
  domain,
}: {
  data: { date: string; value: number }[]
  format: (v: number) => string
  label: string
  color?: string
  height?: number
  domain?: [number, number]
}) {
  const gradientId = `wash-${label.replace(/\W/g, '')}`
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.14} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, 'd MMM')} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={28} />
        <YAxis tickFormatter={format} tick={AXIS} tickLine={false} axisLine={false} width={52} domain={domain} />
        <Tooltip
          cursor={{ stroke: '#d3cec3', strokeWidth: 1 }}
          content={(p: TooltipContentProps<ValueType, NameType>) => {
            if (!p.active || !p.payload?.length) return null
            const d = p.payload[0].payload as { date: string; value: number }
            return <TooltipCard title={fmtDate(d.date, 'EEEE d MMM')} rows={[{ label, value: format(d.value), color }]} />
          }}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Horizontal single-series bars with the value at the tip. Plain HTML so labels never clip. */
export function RankedBars({ data, color = SERIES[0], format = naira }: { data: { label: string; value: number }[]; color?: string; format?: (v: number) => string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(...data.map((d) => d.value))
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label} className="group grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3" title={`${d.label}: ${naira(d.value)} (${((d.value / total) * 100).toFixed(1)}%)`}>
          <span className="truncate text-[12.5px] text-ink-2">{d.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-4 rounded-r-[4px] transition-opacity group-hover:opacity-80" style={{ width: `calc((100% - 132px) * ${d.value / max})`, background: color }} />
            <span className="num shrink-0 text-xs whitespace-nowrap text-ink-2">
              {format(d.value)} <span className="text-ink-3">· {((d.value / total) * 100).toFixed(0)}%</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
