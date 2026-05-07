import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { calculateAge, formatMarketValue, type MockPlayer } from '@/lib/data/mock-players'
import { cn } from '@/lib/utils'

const POSITION_COLORS: Record<MockPlayer['position'], string> = {
  GK: 'border-warning/40 text-warning',
  DF: 'border-primary/40 text-primary',
  MF: 'border-success/40 text-success',
  FW: 'border-destructive/40 text-destructive',
}

const POSITION_LABEL: Record<MockPlayer['position'], string> = {
  GK: 'Kaleci',
  DF: 'Defans',
  MF: 'Orta Saha',
  FW: 'Forvet',
}

export function PlayerCard({ player }: { player: MockPlayer }) {
  const age = calculateAge(player.birthDate)
  const overall = Math.round(
    Object.values(player.attributes).reduce((sum, v) => sum + v, 0) / 6,
  )

  return (
    <Link
      href={`/squad/${player.id}`}
      className={cn(
        'group relative flex flex-col rounded-lg border border-border bg-card p-4 transition-all',
        'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
      )}
    >
      {/* Üst: numara + pozisyon rozetı + sakatlık */}
      <div className="flex items-start justify-between">
        <div className="stat-number text-4xl text-foreground/90">{player.jerseyNumber}</div>
        <div className="flex items-center gap-1.5">
          {player.isInjured && (
            <span
              title="Sakat"
              className="flex h-6 items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 text-[10px] font-medium text-destructive"
            >
              <AlertTriangle className="h-3 w-3" />
              Sakat
            </span>
          )}
          <span
            className={cn(
              'rounded-full border bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              POSITION_COLORS[player.position],
            )}
          >
            {player.position}
          </span>
        </div>
      </div>

      {/* İsim */}
      <div className="mt-3 leading-tight">
        <div className="text-sm text-muted-foreground">{player.firstName}</div>
        <div className="font-display text-lg font-semibold tracking-tight">{player.lastName}</div>
      </div>

      {/* Alt: yaş, pozisyon, genel skor */}
      <div className="mt-3 flex items-end justify-between border-t border-border pt-3 text-xs">
        <div className="space-y-0.5 text-muted-foreground">
          <div>{age} yaş · {POSITION_LABEL[player.position]}</div>
          <div className="font-mono">{formatMarketValue(player.marketValue)}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Genel
          </div>
          <div className="stat-number text-2xl text-primary">{overall}</div>
        </div>
      </div>
    </Link>
  )
}
