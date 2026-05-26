import Link from 'next/link'
import { FileVideo, Users } from 'lucide-react'
import { AddPlayerDialog } from '@/components/squad/AddPlayerDialog'
import { SquadFilters } from '@/components/squad/SquadFilters'
import { getSquadPlayers } from '@/lib/squad'

export const metadata = {
  title: 'Kadro',
}

export const dynamic = 'force-dynamic'

export default async function SquadPage() {
  const players = await getSquadPlayers()
  const injuredCount = players.filter((p) => p.isInjured).length

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">Kadro</h1>
          <p className="text-sm text-muted-foreground">
            Toplam {players.length} oyuncu{injuredCount > 0 && ` · ${injuredCount} sakat`}
          </p>
        </div>
        <AddPlayerDialog />
      </div>

      {players.length === 0 ? (
        <EmptyState />
      ) : (
        <SquadFilters players={players} />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
      <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Kadronuzda henüz oyuncu yok. Üstteki <strong>Oyuncu Ekle</strong> butonuyla
        kadronuzu kurmaya başla.
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        Veya{' '}
        <Link href="/video/upload" className="text-primary hover:underline">
          <FileVideo className="inline h-3 w-3" aria-hidden /> önce maç videosu yükleyebilirsin
        </Link>
        {' '}— oyuncu eklemek opsiyoneldir.
      </p>
    </div>
  )
}
