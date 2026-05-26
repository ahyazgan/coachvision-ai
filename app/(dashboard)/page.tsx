import Link from 'next/link'
import { Activity, Target, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/client'

export const dynamic = 'force-dynamic' // her yüklemede güncel sayım

interface MetricView {
  label: string
  value: string
  delta: string
  icon: typeof Users
}

async function loadMetrics(): Promise<MetricView[]> {
  const now = new Date()
  const [activePlayers, upcoming, injured, recentFitness] = await Promise.all([
    prisma.player.count(),
    prisma.match.count({ where: { date: { gt: now }, status: { not: 'completed' } } }),
    prisma.injury.count({ where: { actualReturn: null } }),
    // Form skoru: son 14 günde alınan FitnessLog'lardan ortalama (100 - yorgunluk)
    prisma.fitnessLog.findMany({
      where: { date: { gt: new Date(now.getTime() - 14 * 24 * 3600 * 1000) } },
      select: { fatigue: true },
      orderBy: { date: 'desc' },
      take: 50,
    }),
  ])

  let formLabel = '—'
  if (recentFitness.length > 0) {
    // Form göstergesi = 100 - ortalama yorgunluk
    const avgFatigue =
      recentFitness.reduce((s, f) => s + f.fatigue, 0) / recentFitness.length
    formLabel = `${Math.round(100 - avgFatigue)}`
  }

  return [
    {
      label: 'Aktif Oyuncu',
      value: String(activePlayers),
      delta: activePlayers > 0 ? 'kadroda' : 'kadro boş',
      icon: Users,
    },
    {
      label: 'Yaklaşan Maç',
      value: String(upcoming),
      delta: upcoming > 0 ? 'planlı' : 'maç yok',
      icon: Target,
    },
    {
      label: 'Sakat Oyuncu',
      value: String(injured),
      delta: injured > 0 ? 'aktif sakatlık' : 'tüm oyuncular sağlıklı',
      icon: Activity,
    },
    {
      label: 'Form Skoru',
      value: formLabel,
      delta: recentFitness.length > 0 ? `son ${recentFitness.length} kayıt` : 'veri yok',
      icon: TrendingUp,
    },
  ]
}

export default async function DashboardHome() {
  const metrics = await loadMetrics()

  return (
    <div className="container space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Pano</h1>
        <p className="text-sm text-muted-foreground">
          Takıma genel bakış. Canlı maç durumu, son antrenman ve AI önerileri yakında.
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
          <CardTitle>Hızlı erişim</CardTitle>
          <CardDescription>Sık kullanılan sayfalar</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <QuickLink href="/squad" label="Kadro" hint="Oyuncuları görüntüle/ekle" />
            <QuickLink href="/match" label="Maçlar" hint="Maç listesi + plan + canlı" />
            <QuickLink href="/video" label="Video Analizleri" hint="Yüklenen maç videoları" />
            <QuickLink href="/live" label="Canlı Yayın" hint="Kamera + tactical kart" />
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

function QuickLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 hover:border-primary"
      >
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </Link>
    </li>
  )
}
