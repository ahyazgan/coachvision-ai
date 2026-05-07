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
          Skoru ve olayları gerçek zamanlı takip et, AI Koç sahanı görür.
        </p>
      </div>

      <LiveMatchView />
    </div>
  )
}
