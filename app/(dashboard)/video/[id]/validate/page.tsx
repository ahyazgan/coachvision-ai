import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Target } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { ValidationWorkbench } from '@/components/validation/ValidationWorkbench'

interface PageProps {
  params: { id: string }
}

export default async function ValidationPage({ params }: PageProps) {
  const video = await prisma.matchVideo.findUnique({
    where: { id: params.id },
    select: { id: true, fileName: true, duration: true, matchId: true },
  })
  if (!video) notFound()

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Link
        href={`/video/${video.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Geri
      </Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Target className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Doğrulama Veri Seti — {video.fileName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Bir saniye seç → sistem o frame'i çıkarır ve oyuncu tespitlerini gösterir →
          sen elle gerçek oyuncu konumlarını işaretlersin → kaydet. Birikmiş sample'lar
          AI motoru için precision/recall/takım ayrımı kanıtı oluşturur.
        </p>
      </header>

      <ValidationWorkbench
        videoId={video.id}
        durationSec={video.duration ?? 90 * 60}
      />
    </div>
  )
}
