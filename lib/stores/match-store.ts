import { create } from 'zustand'
import { MOCK_LIVE_MATCH, type LiveMatchEvent, type MockMatch } from '@/lib/data/mock-match'

interface MatchStore {
  match: MockMatch
  /** Sayaç çalışıyor mu? */
  running: boolean
  start: () => void
  pause: () => void
  /** Dakikayı bir artırır (sayaç tarafından çağrılır). */
  tick: () => void
  addEvent: (event: Omit<LiveMatchEvent, 'id'>) => void
  resetToMock: () => void
}

export const useMatchStore = create<MatchStore>((set) => ({
  match: MOCK_LIVE_MATCH,
  running: false,
  start: () => set({ running: true }),
  pause: () => set({ running: false }),
  tick: () =>
    set((s) => ({
      match: { ...s.match, minute: Math.min(s.match.minute + 1, 120) },
    })),
  addEvent: (event) =>
    set((s) => {
      const id = `e${Date.now()}`
      const newEvent: LiveMatchEvent = { id, ...event }

      // Skoru olaya göre güncelle
      let { homeScore, awayScore } = s.match
      if (event.type === 'goal') {
        if (event.team === 'home') homeScore += 1
        else awayScore += 1
      }

      return {
        match: {
          ...s.match,
          homeScore,
          awayScore,
          events: [...s.match.events, newEvent],
        },
      }
    }),
  resetToMock: () => set({ match: MOCK_LIVE_MATCH, running: false }),
}))
