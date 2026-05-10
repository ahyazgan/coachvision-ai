import Link from 'next/link'
import { Upload, FileVideo, Sparkles, Clock, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

export default async function VideoIndexPage() {
  const videos = await prisma.matchVideo.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { analyses: true } } },
  })

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Video Analizi</h1>
        <p className="text-muted-foreground">
          Maç videolarını yükle, AI takım dizilişini, kompaktlığı ve presi analiz etsin.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Link
          href="/video/upload"
          className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:bg-accent/5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15">
            <Upload className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Video Yükle</h2>
            <p className="text-sm text-muted-foreground">
              MP4, MOV, AVI, MKV — max 2 GB. Sürükle bırak veya seç.
            </p>
          </div>
          <span className="mt-auto text-xs font-mono uppercase tracking-widest text-primary/70 group-hover:text-primary">
            Faz 1 — Aktif
          </span>
        </Link>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-5 opacity-60">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <FileVideo className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Ekran Yakalama</h2>
            <p className="text-sm text-muted-foreground">
              TV/bilgisayar ekranını canlı oku. Faz 2'de gelir.
            </p>
          </div>
          <span className="mt-auto text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Faz 2 — 2 ay
          </span>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/40 p-5 opacity-60">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">Canlı Kamera</h2>
            <p className="text-sm text-muted-foreground">
              Sahada gerçek kamera ile canlı analiz. Faz 3'te gelir.
            </p>
          </div>
          <span className="mt-auto text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Faz 3 — 4-6 ay
          </span>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Geçmiş Analizler</h2>
            <p className="text-sm text-muted-foreground">
              Daha önce yüklenen videolar — son {videos.length} kayıt.
            </p>
          </div>
        </div>

        {videos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
            Henüz video yüklenmemiş. Yukarıdan ilk videonu yükle.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {videos.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/video/${v.id}`}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                    <FileVideo className="h-5 w-5 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{v.fileName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatDistanceToNow(v.createdAt, { addSuffix: true, locale: tr })}
                      </span>
                      <span>{formatSize(v.fileSize)}</span>
                      {v.duration && <span>{formatDuration(v.duration)}</span>}
                      {v._count.analyses > 0 && <span>{v._count.analyses} analiz</span>}
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    uploading: {
      label: 'Yükleniyor',
      className: 'bg-muted text-muted-foreground',
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden />,
    },
    processing: {
      label: 'İşleniyor',
      className: 'bg-primary/15 text-primary',
      icon: <Loader2 className="h-3 w-3 animate-spin" aria-hidden />,
    },
    done: {
      label: 'Tamamlandı',
      className: 'bg-success/15 text-success',
      icon: <CheckCircle2 className="h-3 w-3" aria-hidden />,
    },
    error: {
      label: 'Hata',
      className: 'bg-danger/15 text-danger',
      icon: <AlertCircle className="h-3 w-3" aria-hidden />,
    },
  }
  const v = map[status] ?? map.processing
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium uppercase tracking-widest ${v.className}`}
    >
      {v.icon}
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
