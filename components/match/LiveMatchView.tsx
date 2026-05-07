'use client'

import { useMatchStore } from '@/lib/stores/match-store'
import { LiveScoreboard } from './LiveScoreboard'
import { EventTimeline } from './EventTimeline'
import { EventEntry } from './EventEntry'
import { ChatPanel } from '@/components/ai/ChatPanel'
import { MOCK_PLAYERS } from '@/lib/data/mock-players'
import type { MatchContext } from '@/lib/ai/prompts'

/**
 * Canlı maç ekranı — AI sohbete maç bağlamı otomatik gönderilir.
 * Store'daki match değiştikçe context yenilenir.
 */
export function LiveMatchView() {
  const match = useMatchStore((s) => s.match)

  // CLAUDE.md uyarınca yorgun oyuncuları (>70) bağlama dahil et
  const fatiguedPlayerNames = MOCK_PLAYERS
    .filter((p) => p.fatigue > 70)
    .map((p) => p.lastName)

  const context: MatchContext = {
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    minute: match.minute,
    formation: match.formation,
    fatiguedPlayerNames,
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        <LiveScoreboard />
        <div className="rounded-lg border border-border bg-card p-4">
          <EventEntry />
        </div>
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold">Olaylar</h2>
          <EventTimeline />
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
        <ChatPanel context={context} className="h-full min-h-[480px]" />
      </div>
    </div>
  )
}
