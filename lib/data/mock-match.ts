/**
 * Geliştirme için tek örnek canlı maç. DB bağlandığında
 * prisma.match.findFirst() ile değiştirilir.
 */

export type MatchEventType = 'goal' | 'yellow' | 'red' | 'sub' | 'shot' | 'save' | 'corner' | 'foul'

export interface LiveMatchEvent {
  id: string
  minute: number
  type: MatchEventType
  team: 'home' | 'away'
  /** Olaya bağlı oyuncu id (yoksa boş bırakılır). */
  playerId?: string
  note?: string
}

export interface MockMatch {
  id: string
  homeTeam: string
  awayTeam: string
  competition: string
  venue: string
  date: string
  /** Şu anki skor — events üzerinden de hesaplanabilir; iskelet için saklıyoruz. */
  homeScore: number
  awayScore: number
  /** Maç dakikası. Live store gerçek zamanlı arttırır. */
  minute: number
  formation: string
  status: 'live' | 'halftime' | 'fulltime'
  events: LiveMatchEvent[]
}

export const MOCK_LIVE_MATCH: MockMatch = {
  id: 'm1',
  homeTeam: 'Türkiye',
  awayTeam: 'Hollanda',
  competition: 'EURO 2024 Çeyrek Final',
  venue: 'Olympiastadion, Berlin',
  date: '2025-05-08T19:00:00Z',
  homeScore: 1,
  awayScore: 1,
  minute: 67,
  formation: '4-2-3-1',
  status: 'live',
  events: [
    { id: 'e1', minute: 35, type: 'goal', team: 'home', playerId: 'p9', note: 'Sağ köşeye sert vuruş' },
    { id: 'e2', minute: 42, type: 'yellow', team: 'away', note: '#11 Akke - sert müdahale' },
    { id: 'e3', minute: 51, type: 'shot', team: 'home', playerId: 'p15' },
    { id: 'e4', minute: 58, type: 'goal', team: 'away', note: 'Korner sonrası kafa' },
    { id: 'e5', minute: 64, type: 'sub', team: 'home', playerId: 'p10', note: '↓ Salih  ↑ Arda' },
  ],
}
