import Link from 'next/link'
import { notFound } from 'next/navigation'
import path from 'node:path'
import { existsSync, readdirSync } from 'node:fs'
import {
  ArrowLeft,
  FileVideo,
  Clock,
  AlertCircle,
  Loader2,
  PlayCircle,
  ClipboardList,
  Target,
} from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { AnalysisDashboard } from '@/components/video/AnalysisDashboard'
import { OpponentFormationCard } from '@/components/video/OpponentFormationCard'
import type { BallStats, PlayerTrackSummary, SegmentAdvice } from '@/types/video-analysis'

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

  const previewDir = path.join(process.cwd(), 'public', 'previews')
  const previewFiles = listPreviews(previewDir, video.id)
  const skipped = (video.frameCount ?? 0) - video.analyses.length

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
          {video.frameCount != null && (
            <span className="font-mono text-xs">
              {video.analyses.length} / {video.frameCount} frame anlamlı
            </span>
          )}
          <Link
            href={`/match/${video.matchId}/plan`}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:text-primary"
          >
            <ClipboardList className="h-3 w-3" aria-hidden /> Maç Planı
          </Link>
          <Link
            href={`/video/${video.id}/validate`}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:text-primary"
          >
            <Target className="h-3 w-3" aria-hidden /> Doğrulama
          </Link>
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
          Analiz tamamlandı ama anlamlı frame bulunamadı (her frame'de 4'ten az oyuncu tespit
          edildi). Bu genellikle özet/highlight videolarında olur — kamera sürekli zoom, tekrar
          veya kesim yapar. Sabit kameralı tribün üstü çekim deneyin.
        </div>
      )}

      <VideoPlayer videoId={video.id} fileName={video.fileName} />

      <OpponentFormationCard videoId={video.id} />

      {previewFiles.length > 0 && <PreviewGallery files={previewFiles} />}

      {skipped > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          {skipped} frame atlandı (kesim/zoom/replay — 4'ten az oyuncu görünüyordu). Bu
          videodaki {video.frameCount} hedef frame'in {video.analyses.length}'si anlamlıydı.
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
          segments={(video.segmentAdvice as SegmentAdvice[] | null) ?? []}
          tracks={(video.playerTracks as PlayerTrackSummary[] | null) ?? []}
          ballStats={(video.ballStats as BallStats | null) ?? null}
        />
      )}
    </div>
  )
}

function VideoPlayer({ videoId, fileName }: { videoId: string; fileName: string }) {
  return (
    <details open className="rounded-lg border border-border bg-card p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium hover:text-primary">
        <PlayCircle className="h-4 w-4" aria-hidden />
        Yüklenen videoyu izle
      </summary>
      <div className="mt-3">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={`/api/video/${videoId}/stream`}
          controls
          preload="metadata"
          className="w-full max-h-[480px] rounded-md border border-border bg-black"
        >
          {fileName} oynatılamadı.
        </video>
      </div>
    </details>
  )
}

function PreviewGallery({ files }: { files: string[] }) {
  return (
    <details open className="rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium hover:text-primary">
        AI ne gördü? — YOLOv8 tespit ön izlemeleri ({files.length} kare)
      </summary>
      <div className="mt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Videonun ~%20, ~%50 ve ~%80 noktalarından alındı. Cyan kutu = saha-içi oyuncu, kırmızı
          = saha-dışı (kameraman/seyirci, sayılmıyor). Yeşil tonlama = pipeline'ın bulduğu saha
          maskesi.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {files.map((f) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f}
              src={`/previews/${f}`}
              alt={`Preview ${f}`}
              className="w-full rounded-md border border-border"
            />
          ))}
        </div>
      </div>
    </details>
  )
}

function listPreviews(dir: string, videoId: string): string[] {
  try {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.startsWith(`${videoId}_`) && f.endsWith('.jpg'))
      .sort()
  } catch {
    return []
  }
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
