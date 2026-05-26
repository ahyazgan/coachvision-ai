'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { MatchProgress } from '@/lib/team-progress'

interface Props {
  matches: MatchProgress[]
}

interface ChartPoint {
  label: string
  opponent: string
  compactness: number
  pressure: number
  possession: number | null
  score: string | null
}

const AXIS_COLOR = 'hsl(var(--muted-foreground))'
const GRID_COLOR = 'hsl(var(--border))'

export function ProgressTimeline({ matches }: Props) {
  if (matches.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Bu takım için analiz edilmiş maç yok.
      </div>
    )
  }

  const data: ChartPoint[] = matches.map((m) => ({
    label: format(m.date, 'd MMM', { locale: tr }),
    opponent: m.opponentName,
    compactness: Number(m.avgCompactnessA.toFixed(1)),
    pressure: Math.round(m.avgPressureScore),
    possession: m.possessionA != null ? Math.round(m.possessionA * 100) : null,
    score:
      m.homeScore != null && m.awayScore != null
        ? `${m.homeScore}-${m.awayScore}`
        : null,
  }))

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Maç-bazlı eğilim</h3>
        <span className="font-mono text-xs text-muted-foreground">
          {matches.length} maç · eski → yeni
        </span>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: AXIS_COLOR, fontSize: 11 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
            />
            <YAxis
              yAxisId="m"
              domain={[0, 60]}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
              label={{
                value: 'm',
                position: 'insideLeft',
                dx: 10,
                fontSize: 11,
                fill: AXIS_COLOR,
              }}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: AXIS_COLOR, fontSize: 10 }}
              axisLine={{ stroke: GRID_COLOR }}
              tickLine={{ stroke: GRID_COLOR }}
              label={{
                value: '%',
                position: 'insideRight',
                dx: -10,
                fontSize: 11,
                fill: AXIS_COLOR,
              }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line
              yAxisId="m"
              type="monotone"
              dataKey="compactness"
              name="Kompaktlık (m)"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="pressure"
              name="Pres"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="possession"
              name="Sahiplenme"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: ChartPoint }>
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-semibold">
        {label} · {p.opponent}
        {p.score && <span className="ml-1 font-mono text-muted-foreground">({p.score})</span>}
      </div>
      <div className="mt-1.5 space-y-0.5">
        <Row label="Kompaktlık" value={`${p.compactness} m`} />
        <Row label="Pres" value={`${p.pressure}/100`} />
        {p.possession != null && <Row label="Sahiplenme" value={`%${p.possession}`} />}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}
