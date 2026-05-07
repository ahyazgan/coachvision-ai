import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Calendar, Footprints, Ruler, Weight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlayerRadar } from '@/components/squad/PlayerRadar'
import {
  calculateAge,
  findMockPlayerById,
  formatMarketValue,
  MOCK_PLAYERS,
} from '@/lib/data/mock-players'
import { cn } from '@/lib/utils'

export function generateStaticParams() {
  return MOCK_PLAYERS.map((p) => ({ id: p.id }))
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const player = findMockPlayerById(params.id)
  if (!player) return { title: 'Oyuncu bulunamadı' }
  return { title: `${player.firstName} ${player.lastName}` }
}

const FOOT_LABEL = { left: 'Sol', right: 'Sağ', both: 'Her İki' } as const
const POSITION_LABEL = { GK: 'Kaleci', DF: 'Defans', MF: 'Orta Saha', FW: 'Forvet' } as const

export default function PlayerDetailPage({ params }: { params: { id: string } }) {
  const player = findMockPlayerById(params.id)
  if (!player) notFound()

  const age = calculateAge(player.birthDate)
  const overall = Math.round(
    Object.values(player.attributes).reduce((sum, v) => sum + v, 0) / 6,
  )

  return (
    <div className="container space-y-6 py-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/squad">
          <ArrowLeft className="h-4 w-4" />
          Kadroya dön
        </Link>
      </Button>

      {/* Üst kart - kimlik */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-6">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
            <span className="stat-number text-5xl text-primary">{player.jerseyNumber}</span>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-sm text-muted-foreground">{player.firstName}</div>
            <div className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {player.lastName}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {POSITION_LABEL[player.position]}
              </span>
              <span className="text-muted-foreground">{age} yaş · {player.nationality}</span>
              {player.isInjured && (
                <span className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  Sakat
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Genel
            </div>
            <div className="stat-number text-5xl text-primary">{overall}</div>
            <div className="font-mono text-xs text-muted-foreground">
              {formatMarketValue(player.marketValue)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kişisel bilgiler */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Kişisel Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow icon={Calendar} label="Doğum">
              {new Date(player.birthDate).toLocaleDateString('tr-TR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </InfoRow>
            <InfoRow icon={Ruler} label="Boy">
              {player.height} cm
            </InfoRow>
            <InfoRow icon={Weight} label="Kilo">
              {player.weight} kg
            </InfoRow>
            <InfoRow icon={Footprints} label="Tercih ayak">
              {FOOT_LABEL[player.preferredFoot]}
            </InfoRow>
          </CardContent>
        </Card>

        {/* Form & Yorgunluk */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Form & Yorgunluk</CardTitle>
            <CardDescription>Son 7 gün ortalaması</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Meter label="Form" value={player.form} good />
            <Meter label="Yorgunluk" value={player.fatigue} good={false} />
          </CardContent>
        </Card>

        {/* Radar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Yetenek Profili</CardTitle>
            <CardDescription>Maç verilerinden hesaplandı</CardDescription>
          </CardHeader>
          <CardContent>
            <PlayerRadar attributes={player.attributes} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="font-medium">{children}</span>
    </div>
  )
}

function Meter({ label, value, good }: { label: string; value: number; good: boolean }) {
  // good=true: yüksek değer iyi (form). good=false: yüksek değer kötü (yorgunluk).
  const isHigh = value >= 70
  const tone = good ? (isHigh ? 'success' : 'warning') : isHigh ? 'destructive' : 'success'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="stat-number">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full transition-all',
            tone === 'success' && 'bg-success',
            tone === 'warning' && 'bg-warning',
            tone === 'destructive' && 'bg-destructive',
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
