import { TacticsBoard } from '@/components/pitch/TacticsBoard'

export const metadata = {
  title: 'Taktik Tahtası',
}

export default function TacticsPage() {
  return (
    <div className="container space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Taktik Tahtası</h1>
        <p className="text-sm text-muted-foreground">
          5 formasyon arasında geçiş yap, oyuncuları sürükle-bırak ile konumlandır.
        </p>
      </div>

      <TacticsBoard />
    </div>
  )
}
