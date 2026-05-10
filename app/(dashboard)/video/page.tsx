import Link from 'next/link'
import { Upload, FileVideo, Sparkles } from 'lucide-react'

export default function VideoIndexPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
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
    </div>
  )
}
