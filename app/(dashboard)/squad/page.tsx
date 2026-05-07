import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SquadFilters } from '@/components/squad/SquadFilters'
import { MOCK_PLAYERS } from '@/lib/data/mock-players'

export const metadata = {
  title: 'Kadro',
}

export default function SquadPage() {
  // TODO: DB bağlandığında prisma.player.findMany() ile değiştir
  const players = MOCK_PLAYERS

  return (
    <div className="container space-y-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight">Kadro</h1>
          <p className="text-sm text-muted-foreground">
            Toplam {players.length} oyuncu · {players.filter((p) => p.isInjured).length} sakat
          </p>
        </div>
        <Button disabled title="Veritabanı bağlandıktan sonra aktif">
          <UserPlus className="h-4 w-4" />
          Oyuncu Ekle
        </Button>
      </div>

      <SquadFilters players={players} />
    </div>
  )
}
