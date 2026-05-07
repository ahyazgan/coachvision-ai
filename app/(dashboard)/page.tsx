import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, Target, TrendingUp, Users } from 'lucide-react'

const metrics = [
  { label: 'Aktif Oyuncu', value: '0', delta: '—', icon: Users },
  { label: 'Yaklaşan Maç', value: '0', delta: '—', icon: Target },
  { label: 'Sakat Oyuncu', value: '0', delta: '—', icon: Activity },
  { label: 'Form Skoru', value: '—', delta: '—', icon: TrendingUp },
]

export default function DashboardHome() {
  return (
    <div className="container space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Pano</h1>
        <p className="text-sm text-muted-foreground">
          Takıma genel bakış. Yakında: canlı maç durumu, son antrenman özeti, AI önerileri.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon
          return (
            <Card key={m.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardDescription className="font-mono uppercase tracking-wider">
                  {m.label}
                </CardDescription>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="stat-number text-3xl">{m.value}</div>
                <p className="text-xs text-muted-foreground">{m.delta}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hoş geldiniz</CardTitle>
          <CardDescription>
            CoachVision AI MVP iskeleti hazır. Sıradaki adım: kadro ve taktik tahtası modülleri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <li>• Sol menüden modüllere ulaşın</li>
            <li>• Veritabanı bağlantısı için <code className="font-mono">.env.local</code></li>
            <li>• AI sohbet için ANTHROPIC_API_KEY gerekli</li>
            <li>• Tüm UI Türkçe, koyu tema öncelikli</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
