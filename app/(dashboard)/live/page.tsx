import { LiveCameraBroadcast } from '@/components/match/LiveCameraBroadcast'
import { LiveMatchView } from '@/components/match/LiveMatchView'

export const metadata = {
  title: 'Canlı Maç',
}

export default function LivePage() {
  return (
    <div className="container space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Canlı Maç</h1>
        <p className="text-sm text-muted-foreground">
          Kamerayı sahaya yönelt — AI olayları yayın üstüne bildirim olarak bindirir.
        </p>
      </div>

      <LiveCameraBroadcast />

      <details className="rounded-lg border border-border bg-card">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:text-primary">
          Manuel olay girişi & AI Koç sohbeti
        </summary>
        <div className="border-t border-border p-4">
          <LiveMatchView />
        </div>
      </details>
    </div>
  )
}
