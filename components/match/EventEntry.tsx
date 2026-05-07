'use client'

import { ArrowDownUp, Square, Target, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMatchStore } from '@/lib/stores/match-store'
import type { MatchEventType } from '@/lib/data/mock-match'

interface QuickAction {
  type: MatchEventType
  label: string
  icon: LucideIcon
  variant?: 'default' | 'outline' | 'destructive' | 'secondary'
}

const ACTIONS: QuickAction[] = [
  { type: 'goal', label: 'Gol', icon: Zap, variant: 'default' },
  { type: 'shot', label: 'Şut', icon: Target, variant: 'outline' },
  { type: 'yellow', label: 'Sarı', icon: Square, variant: 'secondary' },
  { type: 'red', label: 'Kırmızı', icon: Square, variant: 'destructive' },
  { type: 'sub', label: 'Değişiklik', icon: ArrowDownUp, variant: 'outline' },
]

export function EventEntry() {
  const { match, addEvent } = useMatchStore()

  const log = (type: MatchEventType, team: 'home' | 'away') => {
    addEvent({ type, team, minute: match.minute })
  }

  return (
    <div className="space-y-3">
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Hızlı Olay Girişi · {match.minute}&apos;
      </div>

      {(['home', 'away'] as const).map((side) => (
        <div key={side} className="space-y-1.5">
          <div className="text-xs text-muted-foreground">
            {side === 'home' ? match.homeTeam : match.awayTeam}
          </div>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((a) => {
              const Icon = a.icon
              return (
                <Button
                  key={a.type}
                  size="sm"
                  variant={a.variant}
                  onClick={() => log(a.type, side)}
                >
                  <Icon className="h-4 w-4" />
                  {a.label}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
