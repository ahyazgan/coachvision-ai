import Link from 'next/link'
import { notFound } from 'next/navigation'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { ArrowLeft, FileVideo, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { AnalysisDashboard } from '@/components/video/AnalysisDashboard'

interface PageProps {
  params: { id: string }
}

export default async function VideoResultPage({ params }: PageProps) {
  const video = await prisma.matchVideo.findUnique({
    where: { id: params.id },
    include: {
      analyses: {
        orderBy: [{ minute: 'asc' }, { frameNumber: 'asc' }],
      },
    },
  })

  if (!video) notFound()

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Link
        href="/video"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Video Analizi
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">{video.fileName}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileVideo className="h-4 w-4" aria-hidden />
            {formatSize(video.fileSize)}
          </span>
          {video.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden />
              {formatDuration(video.duration)}
            </span>
          )}
          <StatusBadge status={video.status} />
          {video.frameCount && (
            <span className="font-mono text-xs">
              {video.frameCount} frame analiz edildi
            </span>
          )}
        </div>
      </header>

      {video.status === 'processing' && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
          <span>Analiz devam ediyor — sayfayı yenileyin.</span>
        </div>
      )}

      {video.status === 'error' && (
        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>{video.errorMsg ?? 'Analiz sırasında hata oluştu.'}</span>
        </div>
      )}

      {video.status === 'done' && video.analyses.length === 0 && (
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          Analiz tamamlandı ama anlamlı frame bulunamadı (her frame'de 4'ten az oyuncu tespit edildi).
          Bu genellikle özet/highlight videolarında olur — kamera sürekli zoom, tekrar veya kesim yapar.
          Sabit kameralı tribün üstü çekim deneyin.
        </div>
      )}

      {existsSync(path.join(process.cwd(), 'public', 'previews', `${video.id}.jpg`)) && (
        <PreviewCard videoId={video.id} />
      )}

      {video.frameCount && video.analyses.length < video.frameCount && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          {video.frameCount - video.analyses.length} frame atlandı (kesim/zoom/replay — 4'ten az oyuncu).
          Sadece {video.analyses.length} anlamlı frame analiz edildi.
        </div>
      )}

      {video.analyses.length > 0 && (
        <AnalysisDashboard
          analyses={video.analyses.map((a) => ({
            id: a.id,
            minute: a.minute,
            playerCountA: a.playerCountA,
            playerCountB: a.playerCountB,
            compactnessA: a.compactnessA,
            compactnessB: a.compactnessB,
            pressureScore: a.pressureScore,
            zonesA: a.zonesA as Record<string, number>,
            zonesB: a.zonesB as Record<string, number>,
            heatmapA: a.heatmapA as number[][] | null,
            heatmapB: a.heatmapB as number[][] | null,
            aiAdvice: a.aiAdvice,
          }))}
        />
      )}
    </div>
  )
}

function PreviewCard({ videoId }: { videoId: string }) {
  return (
    <details className="rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium hover:text-primary">
        AI ne gördü? — YOLOv8 tespit ön izlemesi
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Pipeline'ın bulduğu ilk kalabalık karenin işaretli hali. Cyan kutular = tespit edilen
          oyuncu, üstündeki sayı = güven skoru (0.4+).
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/previews/${videoId}.jpg`}
          alt="YOLOv8 tespit ön izlemesi"
          className="w-full max-w-2xl rounded-md border border-border"
        />
      </div>
    </details>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    uploading: { label: 'Yükleniyor', className: 'bg-muted text-muted-foreground' },
    processing: { label: 'İşleniyor', className: 'bg-primary/15 text-primary' },
    done: { label: 'Tamamlandı', className: 'bg-success/15 text-success' },
    error: { label: 'Hata', className: 'bg-danger/15 text-danger' },
  }
  const v = map[status] ?? map.processing
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium uppercase tracking-widest ${v.className}`}
    >
      {v.label}
    </span>
  )
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
