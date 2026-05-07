'use client'

import { useEffect } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMatchStore } from '@/lib/stores/match-store'
import { cn } from '@/lib/utils'

export function LiveScoreboard() {
  const { match, running, start, pause, tick, resetToMock } = useMatchStore()

  // Sayaç: 4 saniyede 1 dakika ilerlesin (gerçekçi tempo)
  useEffect(() => {
    if (!running) return
    const interval = setInterval(tick, 4000)
    return () => clearInterval(interval)
  }, [running, tick])

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {match.competition}
          </div>
          <div className="text-xs text-muted-foreground">{match.venue}</div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-2 w-2 rounded-full',
              running ? 'animate-pulse-glow bg-success' : 'bg-muted',
            )}
          />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {match.status === 'live' ? (running ? 'Canlı' : 'Duraklatıldı') : match.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <TeamBlock name={match.homeTeam} score={match.homeScore} side="home" />

        <div className="flex flex-col items-center">
          <div className="stat-number text-xl text-primary">{match.minute}&apos;</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Dakika
          </div>
          <div className="mt-2 font-mono text-[10px] text-muted-foreground">{match.formation}</div>
        </div>

        <TeamBlock name={match.awayTeam} score={match.awayScore} side="away" />
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {running ? (
          <Button onClick={pause} variant="outline" size="sm">
            <Pause className="h-4 w-4" />
            Duraklat
          </Button>
        ) : (
          <Button onClick={start} size="sm">
            <Play className="h-4 w-4" />
            Başlat
          </Button>
        )}
        <Button onClick={resetToMock} variant="ghost" size="sm">
          <RotateCcw className="h-4 w-4" />
          Sıfırla
        </Button>
      </div>
    </div>
  )
}

function TeamBlock({ name, score, side }: { name: string; score: number; side: 'home' | 'away' }) {
  return (
    <div className={cn('flex flex-col gap-1', side === 'home' ? 'items-start' : 'items-end')}>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {side === 'home' ? 'Ev Sahibi' : 'Deplasman'}
      </div>
      <div className="font-display text-xl font-bold sm:text-2xl">{name}</div>
      <div
        className={cn(
          'stat-number text-5xl sm:text-6xl',
          side === 'home' ? 'text-team-home' : 'text-team-away',
        )}
      >
        {score}
      </div>
    </div>
  )
}
