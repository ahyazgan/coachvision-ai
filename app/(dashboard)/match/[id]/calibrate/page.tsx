import Link from 'next/link'
import { notFound } from 'next/navigation'
import path from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import { ArrowLeft, Compass } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { PitchCalibrationCanvas } from '@/components/match/PitchCalibrationCanvas'

interface PageProps {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export default async function CalibratePage({ params }: PageProps) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    include: {
      plan: { select: { calibration: true } },
      videos: {
        where: { status: 'done' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, fileName: true },
      },
    },
  })
  if (!match) notFound()

  const video = match.videos[0]
  const previewPath = video ? pickPreview(video.id) : null
  const hasExisting = match.plan?.calibration != null

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link
        href={`/match/${match.id}/plan`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Plana dön
      </Link>

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Saha Kalibrasyonu — vs {match.awayTeamName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Kamera perspektifi sahayı çarpıtıyor — 3x3 bölge gerçek sahada eşit alanlar
          değil, kompaktlık metre değil. 4 referans noktayla homografi hesaplayıp
          tüm metrikleri gerçek metre cinsinden çalıştırırız.
        </p>
      </header>

      {!previewPath ? (
        <EmptyState matchId={match.id} hasVideo={video != null} />
      ) : (
        <PitchCalibrationCanvas
          matchId={match.id}
          previewPath={previewPath}
          hasExisting={hasExisting}
        />
      )}
    </div>
  )
}

function EmptyState({ matchId, hasVideo }: { matchId: string; hasVideo: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-sm">
      <p className="text-muted-foreground">
        {hasVideo
          ? 'Bu maça bağlı video tamamlanmış ama preview kareleri henüz oluşmamış. Video sayfasını yenileyin.'
          : 'Bu maça analiz tamamlanmış bir video yok. Kalibrasyon için referans kare gerekli.'}
      </p>
      <Link
        href={hasVideo ? `/match/${matchId}/plan` : '/video/upload'}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        {hasVideo ? 'Plana dön' : 'Video yükle'}
      </Link>
    </div>
  )
}

// Public/previews altından bu video için en uygun frame'i seç (orta = ~%50)
function pickPreview(videoId: string): string | null {
  try {
    const dir = path.join(process.cwd(), 'public', 'previews')
    if (!existsSync(dir)) return null
    const files = readdirSync(dir)
      .filter((f) => f.startsWith(`${videoId}_`) && f.endsWith('.jpg'))
      .sort()
    if (files.length === 0) return null
    // Pipeline %20, %50, %80'de kare çıkarıyor → orta olan en kararlı sahnedir
    const middle = files[Math.floor(files.length / 2)]!
    return `/previews/${middle}`
  } catch {
    return null
  }
}
