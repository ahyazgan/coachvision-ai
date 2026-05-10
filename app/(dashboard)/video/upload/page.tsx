import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { VideoUploader } from '@/components/video/VideoUploader'

export default function VideoUploadPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link
        href="/video"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Video Analizi
      </Link>

      <header className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">Video Yükle</h1>
        <p className="text-muted-foreground">
          Maç videosunu yükle. Sistem her 2 saniyede bir frame alacak, oyuncuları tespit edecek
          ve taktik analiz üretecek.
        </p>
      </header>

      <VideoUploader />

      <aside className="rounded-md border border-border bg-card/40 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-2">İpuçları</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Sabit kameralı (tribün üstü) çekimler en iyi sonuç verir.</li>
          <li>Yayın kalitesi 720p ve üzeri olmalı.</li>
          <li>Tam maç yerine sadece highlight da yükleyebilirsin.</li>
          <li>Analiz süresi video uzunluğunun yaklaşık 1/4'ü kadardır.</li>
        </ul>
      </aside>
    </div>
  )
}
