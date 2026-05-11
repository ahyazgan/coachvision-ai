'use client'

import { useMemo, useState } from 'react'
import { Sparkles, Users, Activity, Flame, Clock, Footprints, Circle, ArrowLeftRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BallStats, PlayerTrackSummary, SegmentAdvice } from '@/types/video-analysis'

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
  segments?: SegmentAdvice[]
  tracks?: PlayerTrackSummary[]
  ballStats?: BallStats | null
}

export function AnalysisDashboard({
  analyses,
  segments = [],
  tracks = [],
  ballStats = null,
}: Props) {
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

        {ballStats && ballStats.frames_with_ball > 0 && (
          <BallStatsPanel stats={ballStats} />
        )}

        {tracks.length > 0 && <PlayerTracksPanel tracks={tracks} />}

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
        <SegmentTimeline segments={segments} fallback={summary.lastAdvice} />

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

function BallStatsPanel({ stats }: { stats: BallStats }) {
  const aPct = Math.round(stats.possession.a * 100)
  const bPct = Math.round(stats.possession.b * 100)
  const unknownPct = Math.max(0, 100 - aPct - bPct)
  const visibilityPct = Math.round(stats.ball_visibility * 100)
  const switches = stats.events.filter((e) => e.type === 'possession_switch')

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Circle className="h-4 w-4 fill-current text-warning" aria-hidden />
        <h2 className="font-display text-lg font-semibold">Top & Sahiplenme</h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {stats.frames_with_ball}/{stats.frames_total} frame · görünürlük %{visibilityPct}
        </span>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs font-mono">
          <span className="text-primary">A %{aPct}</span>
          {unknownPct > 0 && <span className="text-muted-foreground">? %{unknownPct}</span>}
          <span className="text-danger">B %{bPct}</span>
        </div>
        <div className="flex h-3 overflow-hidden rounded-full border border-border bg-background">
          <div className="bg-primary" style={{ width: `${aPct}%` }} />
          <div className="bg-muted-foreground/40" style={{ width: `${unknownPct}%` }} />
          <div className="bg-danger" style={{ width: `${bPct}%` }} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            Top bölge dağılımı
          </h3>
          <BallZoneGrid zoneCounts={stats.zone_counts} />
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground">
            <ArrowLeftRight className="h-3 w-3" aria-hidden />
            Sahiplenme geçişleri ({switches.length})
          </h3>
          {switches.length === 0 ? (
            <p className="text-xs text-muted-foreground">Olay yok.</p>
          ) : (
            <ol className="max-h-48 space-y-1 overflow-y-auto pr-1">
              {switches.slice(0, 20).map((ev, i) => (
                <li
                  key={`${ev.timestamp_sec}-${i}`}
                  className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1 text-xs"
                >
                  <span className="font-mono font-semibold">{ev.minute}'</span>
                  <span className={cn(
                    'rounded px-1 font-mono text-[10px]',
                    ev.from_team === 0 ? 'bg-primary/20 text-primary' : 'bg-danger/20 text-danger',
                  )}>
                    {ev.from_team === 0 ? 'A' : 'B'}
                  </span>
                  <ArrowLeftRight className="h-3 w-3 text-muted-foreground" aria-hidden />
                  <span className={cn(
                    'rounded px-1 font-mono text-[10px]',
                    ev.to_team === 0 ? 'bg-primary/20 text-primary' : 'bg-danger/20 text-danger',
                  )}>
                    {ev.to_team === 0 ? 'A' : 'B'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  )
}

function BallZoneGrid({ zoneCounts }: { zoneCounts: Record<string, number> }) {
  const max = Math.max(1, ...ZONE_NAMES.map((z) => zoneCounts[z] ?? 0))
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background/40 p-2">
      {ZONE_NAMES.map((z) => {
        const count = zoneCounts[z] ?? 0
        const opacity = count > 0 ? 0.2 + (count / max) * 0.8 : 0.05
        return (
          <div key={z} className="relative aspect-square rounded-sm">
            <div
              className="absolute inset-0 rounded-sm bg-warning"
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
  )
}

function PlayerTracksPanel({ tracks }: { tracks: PlayerTrackSummary[] }) {
  const teamA = tracks.filter((t) => t.team === 0)
  const teamB = tracks.filter((t) => t.team === 1)
  const unknown = tracks.filter((t) => t.team !== 0 && t.team !== 1)
  const maxDist = Math.max(1, ...tracks.map((t) => t.pixel_distance))
  const topRunners = [...tracks]
    .sort((a, b) => b.pixel_distance - a.pixel_distance)
    .slice(0, 10)

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Footprints className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-lg font-semibold">Oyuncu Hareketi</h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {tracks.length} stabil iz · A:{teamA.length} · B:{teamB.length}
          {unknown.length > 0 && ` · ?:${unknown.length}`}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Frame'ler arası eşleştirilmiş oyuncular. Mesafeler piksel uzayında —
        homografi yok, kamera açısına göre değişir; aynı maç içinde göreceli
        karşılaştırma için anlamlıdır.
      </p>
      <ol className="space-y-1.5">
        {topRunners.map((t, i) => (
          <TrackRow key={t.id} track={t} rank={i + 1} maxDist={maxDist} />
        ))}
      </ol>
    </section>
  )
}

function TrackRow({
  track,
  rank,
  maxDist,
}: {
  track: PlayerTrackSummary
  rank: number
  maxDist: number
}) {
  const teamLabel = track.team === 0 ? 'A' : track.team === 1 ? 'B' : '?'
  const teamColor =
    track.team === 0 ? 'bg-primary' : track.team === 1 ? 'bg-danger' : 'bg-muted-foreground'
  const widthPct = (track.pixel_distance / maxDist) * 100
  return (
    <li className="grid grid-cols-[2rem_2rem_2.5rem_1fr_auto] items-center gap-2 text-xs">
      <span className="font-mono text-muted-foreground">#{rank}</span>
      <span
        className={cn(
          'rounded-md px-1.5 py-0.5 text-center font-mono font-semibold text-primary-foreground',
          teamColor,
        )}
      >
        {teamLabel}
      </span>
      <span className="font-mono text-muted-foreground">id{track.id}</span>
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', teamColor)}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="font-mono tabular-nums">
        {track.pixel_distance.toFixed(0)}px ·{' '}
        <span className="text-muted-foreground">
          {track.active_from_minute}'-{track.active_to_minute}'
        </span>
      </span>
    </li>
  )
}

function SegmentTimeline({
  segments,
  fallback,
}: {
  segments: SegmentAdvice[]
  fallback: string | null
}) {
  // Yedek: pipeline segmentleri üretmediyse eski tek-özet davranışı
  if (segments.length === 0) {
    return (
      <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
          AI Koç Tavsiyesi
        </div>
        {fallback ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{fallback}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            AI tavsiye üretilmedi. ANTHROPIC_API_KEY tanımlı mı kontrol edin.
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
        <Sparkles className="h-4 w-4" aria-hidden />
        Zaman Serisi Yorumu
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {segments.length} dilim
        </span>
      </div>
      <ol className="space-y-3">
        {segments.map((s) => (
          <SegmentItem key={`${s.minute_from}-${s.minute_to}`} segment={s} />
        ))}
      </ol>
    </section>
  )
}

function SegmentItem({ segment }: { segment: SegmentAdvice }) {
  const compactnessDiff = segment.avg_compactness_b - segment.avg_compactness_a
  const trend = compactnessDiff > 3 ? 'B daha açık' : compactnessDiff < -3 ? 'A daha açık' : 'denge'
  return (
    <li className="rounded-md border border-border bg-background/40 p-3">
      <header className="mb-2 flex items-center gap-2 text-xs">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="font-mono font-semibold">
          {segment.minute_from}'-{segment.minute_to}'
        </span>
        <span className="text-muted-foreground">· {segment.frames_count} frame</span>
        <span className="ml-auto flex items-center gap-1 font-mono text-muted-foreground">
          <Flame className="h-3 w-3" aria-hidden />
          {segment.pressure_avg.toFixed(0)}
        </span>
      </header>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{segment.advice}</p>
      <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
        <span>kompakt A {segment.avg_compactness_a.toFixed(0)}m</span>
        <span>·</span>
        <span>kompakt B {segment.avg_compactness_b.toFixed(0)}m</span>
        <span>·</span>
        <span>{trend}</span>
      </div>
    </li>
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
