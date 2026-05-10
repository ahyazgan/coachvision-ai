'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Users, Activity, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnalysisRow {
  id: string
  minute: number
  playerCountA: number
  playerCountB: number
  compactnessA: number
  compactnessB: number
  pressureScore: number
  zonesA: Record<string, number>
  zonesB: Record<string, number>
  heatmapA: number[][] | null
  heatmapB: number[][] | null
  aiAdvice: string | null
}

interface Props {
  analyses: AnalysisRow[]
}

export function AnalysisDashboard({ analyses }: Props) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const selected = analyses[selectedIdx] ?? analyses[0]

  const summary = useMemo(() => {
    const n = analyses.length
    if (n === 0) return null
    const avg = (k: keyof AnalysisRow) =>
      analyses.reduce((s, a) => s + (a[k] as number), 0) / n
    return {
      avgCompactnessA: avg('compactnessA'),
      avgCompactnessB: avg('compactnessB'),
      avgPressure: avg('pressureScore'),
      avgPlayersA: avg('playerCountA'),
      avgPlayersB: avg('playerCountB'),
      lastAdvice: analyses.findLast?.((a) => a.aiAdvice)?.aiAdvice ?? null,
    }
  }, [analyses])

  if (!summary || !selected) return null

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <SummaryGrid summary={summary} />

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Frame Sekmesi</h2>
          <div className="mb-4 flex flex-wrap gap-1">
            {analyses.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setSelectedIdx(i)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-mono text-xs transition-colors',
                  i === selectedIdx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent/20',
                )}
                aria-label={`Dakika ${a.minute} analizi`}
              >
                {a.minute}'
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ZoneGrid label="Takım A" zones={selected.zonesA} accent="bg-primary" />
            <ZoneGrid label="Takım B" zones={selected.zonesB} accent="bg-danger" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Stat
              label="Oyuncular (A · B)"
              value={`${selected.playerCountA} · ${selected.playerCountB}`}
              icon={<Users className="h-4 w-4" aria-hidden />}
            />
            <Stat
              label="Kompaktlık"
              value={`${selected.compactnessA.toFixed(0)} · ${selected.compactnessB.toFixed(0)} m`}
              icon={<Activity className="h-4 w-4" aria-hidden />}
            />
            <Stat
              label="Pres"
              value={`${selected.pressureScore.toFixed(0)} / 100`}
              icon={<Flame className="h-4 w-4" aria-hidden />}
            />
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" aria-hidden />
            AI Koç Tavsiyesi
          </div>
          {summary.lastAdvice ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{summary.lastAdvice}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              AI tavsiye üretilmedi. ANTHROPIC_API_KEY tanımlı mı kontrol edin.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-sm font-medium">Pres yoğunluğu zaman çizgisi</h3>
          <PressureSparkline data={analyses.map((a) => a.pressureScore)} />
        </section>
      </aside>
    </div>
  )
}

function SummaryGrid({
  summary,
}: {
  summary: {
    avgCompactnessA: number
    avgCompactnessB: number
    avgPressure: number
    avgPlayersA: number
    avgPlayersB: number
  }
}) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Stat
        label="Ort. oyuncu A"
        value={summary.avgPlayersA.toFixed(1)}
        icon={<Users className="h-4 w-4" aria-hidden />}
      />
      <Stat
        label="Ort. oyuncu B"
        value={summary.avgPlayersB.toFixed(1)}
        icon={<Users className="h-4 w-4" aria-hidden />}
      />
      <Stat
        label="Ort. kompaktlık"
        value={`${summary.avgCompactnessA.toFixed(0)} · ${summary.avgCompactnessB.toFixed(0)} m`}
        icon={<Activity className="h-4 w-4" aria-hidden />}
      />
      <Stat
        label="Ort. pres"
        value={`${summary.avgPressure.toFixed(0)} / 100`}
        icon={<Flame className="h-4 w-4" aria-hidden />}
      />
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
    </div>
  )
}

const ZONE_NAMES = [
  'top_left', 'top_center', 'top_right',
  'mid_left', 'mid_center', 'mid_right',
  'bot_left', 'bot_center', 'bot_right',
]

function ZoneGrid({
  label,
  zones,
  accent,
}: {
  label: string
  zones: Record<string, number>
  accent: string
}) {
  const max = Math.max(1, ...ZONE_NAMES.map((z) => zones[z] ?? 0))
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background/40 p-2">
        {ZONE_NAMES.map((z) => {
          const count = zones[z] ?? 0
          const opacity = count > 0 ? 0.2 + (count / max) * 0.8 : 0.05
          return (
            <div
              key={z}
              className="relative aspect-square rounded-sm"
              style={{ backgroundColor: 'transparent' }}
            >
              <div
                className={cn('absolute inset-0 rounded-sm', accent)}
                style={{ opacity }}
                aria-hidden
              />
              <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-foreground">
                {count}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PressureSparkline({ data }: { data: number[] }) {
  if (data.length === 0) return null
  const w = 100
  const h = 40
  const max = 100
  const points = data
    .map((v, i) => `${(i / Math.max(1, data.length - 1)) * w},${h - (v / max) * h}`)
    .join(' ')
  const avg = data.reduce((a, b) => a + b, 0) / data.length

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-primary"
          points={points}
        />
      </svg>
      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>min: {Math.min(...data).toFixed(0)}</span>
        <span>ort: {avg.toFixed(0)}</span>
        <span>max: {Math.max(...data).toFixed(0)}</span>
      </div>
    </div>
  )
}
