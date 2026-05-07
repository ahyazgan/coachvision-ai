'use client'

import { ArrowDownUp, CornerUpLeft, ShieldAlert, Square, Target, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMatchStore } from '@/lib/stores/match-store'
import type { LiveMatchEvent, MatchEventType } from '@/lib/data/mock-match'
import { cn } from '@/lib/utils'

const EVENT_META: Record<
  MatchEventType,
  { icon: LucideIcon; label: string; tone: 'success' | 'warning' | 'destructive' | 'muted' }
> = {
  goal: { icon: Zap, label: 'Gol', tone: 'success' },
  yellow: { icon: Square, label: 'Sarı Kart', tone: 'warning' },
  red: { icon: Square, label: 'Kırmızı Kart', tone: 'destructive' },
  sub: { icon: ArrowDownUp, label: 'Oyuncu Değişikliği', tone: 'muted' },
  shot: { icon: Target, label: 'Şut', tone: 'muted' },
  save: { icon: ShieldAlert, label: 'Kurtarış', tone: 'muted' },
  corner: { icon: CornerUpLeft, label: 'Korner', tone: 'muted' },
  foul: { icon: ShieldAlert, label: 'Faul', tone: 'muted' },
}

const TONE_CLASSES: Record<'success' | 'warning' | 'destructive' | 'muted', string> = {
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
  muted: 'border-border bg-card text-muted-foreground',
}

export function EventTimeline() {
  const events = useMatchStore((s) => s.match.events)

  // Yeni olaylar üstte gözüksün
  const sorted = [...events].sort((a, b) => b.minute - a.minute)

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Henüz olay yok. Aşağıdaki butonlarla olay ekleyin.
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {sorted.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </ul>
  )
}

function EventRow({ event }: { event: LiveMatchEvent }) {
  const meta = EVENT_META[event.type]
  const Icon = meta.icon

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-md border p-3 text-sm',
        TONE_CLASSES[meta.tone],
      )}
    >
      <div className="stat-number w-10 shrink-0 text-center text-base text-foreground">
        {event.minute}&apos;
      </div>
      <Icon className="h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {meta.label}
          <span className="ml-2 text-xs uppercase tracking-wider text-muted-foreground">
            {event.team === 'home' ? 'Ev' : 'Dep'}
          </span>
        </div>
        {event.note && <div className="text-xs text-muted-foreground">{event.note}</div>}
      </div>
    </li>
  )
}
