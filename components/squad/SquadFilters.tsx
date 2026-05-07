'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import { PlayerCard } from './PlayerCard'
import { Input } from '@/components/ui/input'
import { type MockPlayer, type PlayerPosition } from '@/lib/data/mock-players'
import { cn } from '@/lib/utils'

type Filter = 'ALL' | PlayerPosition | 'INJURED'

const FILTER_OPTIONS: { id: Filter; label: string }[] = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'GK', label: 'Kaleci' },
  { id: 'DF', label: 'Defans' },
  { id: 'MF', label: 'Orta Saha' },
  { id: 'FW', label: 'Forvet' },
  { id: 'INJURED', label: 'Sakat' },
]

export function SquadFilters({ players }: { players: MockPlayer[] }) {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')

  const filtered = players.filter((p) => {
    if (filter === 'INJURED' && !p.isInjured) return false
    if (filter !== 'ALL' && filter !== 'INJURED' && p.position !== filter) return false
    if (normalizedQuery) {
      const hay = `${p.firstName} ${p.lastName} ${p.jerseyNumber}`.toLocaleLowerCase('tr-TR')
      if (!hay.includes(normalizedQuery)) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setFilter(opt.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                filter === opt.id
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="İsim veya numara ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {filtered.length} oyuncu
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aramanıza uygun oyuncu bulunamadı.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <PlayerCard key={p.id} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}
