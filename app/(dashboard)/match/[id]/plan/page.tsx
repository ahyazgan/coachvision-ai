import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, ClipboardList, Compass, Radio } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { MatchPlanForm, type PlanPayload } from '@/components/match/MatchPlanForm'

interface PageProps {
  params: { id: string }
}

export default async function MatchPlanPage({ params }: PageProps) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: { plan: true },
  })
  if (!match) notFound()

  const initial: PlanPayload | null = match.plan
    ? {
        name: match.plan.name,
        formation: match.plan.formation,
        teamInstructions: match.plan.teamInstructions as unknown as PlanPayload['teamInstructions'],
        thresholds: match.plan.thresholds as unknown as PlanPayload['thresholds'],
        notes: match.plan.notes ?? '',
      }
    : null

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link
        href={`/video?match=${match.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Geri
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Maç Planı — vs {match.awayTeamName}
          </h1>
          {match.plan && (
            <Link
              href={`/live?match=${match.id}`}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Radio className="h-4 w-4" aria-hidden /> Canlı yayında kullan
            </Link>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Football Manager mantığı: bu plana göre canlı sahadaki sapmalar uyarı olarak
          gelir. Eşikler senin maçına özel ayarlanmalı; varsayılan değerler genel
          futbol için ortalama tahminlerdir.
        </p>
      </header>

      <CalibrationStatus matchId={match.id} calibrated={match.plan?.calibration != null} />

      <MatchPlanForm
        matchId={match.id}
        opponentName={match.awayTeamName}
        initial={initial}
      />
    </div>
  )
}

function CalibrationStatus({ matchId, calibrated }: { matchId: string; calibrated: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
      <Compass className="h-5 w-5 text-primary" aria-hidden />
      <div className="flex-1 space-y-0.5">
        <h2 className="font-display text-base font-semibold">Saha Kalibrasyonu</h2>
        {calibrated ? (
          <p className="inline-flex items-center gap-1 text-xs text-success">
            <Check className="h-3 w-3" aria-hidden /> Kalibre — kompaktlık gerçek metre cinsinden hesaplanıyor
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Kalibre değil — kompaktlık yaklaşık metre. Eşiklerin güvenilirliği için 4 noktayı işaretle.
          </p>
        )}
      </div>
      <Link
        href={`/match/${matchId}/calibrate`}
        className={
          calibrated
            ? 'inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:text-foreground'
            : 'inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90'
        }
      >
        {calibrated ? 'Düzenle' : 'Kalibrasyon yap'}
      </Link>
    </div>
  )
}
