'use client'

import { useCallback, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Upload, FileVideo, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-matroska': ['.mkv'],
}

const MAX_BYTES = 2_000 * 1024 * 1024 // 2 GB

type UploadState =
  | { kind: 'idle' }
  | { kind: 'uploading'; progress: number }
  | { kind: 'processing'; videoId: string; progress: number; stage?: string }
  | { kind: 'done'; videoId: string }
  | { kind: 'error'; message: string }

interface VideoUploaderProps {
  matchId?: string
}

export function VideoUploader({ matchId }: VideoUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>({ kind: 'idle' })

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) {
      const first = rejected[0]
      const reason =
        first.errors[0]?.code === 'file-too-large'
          ? `Dosya çok büyük (max 2 GB)`
          : first.errors[0]?.code === 'file-invalid-type'
            ? `Desteklenmeyen format. Sadece MP4, MOV, AVI, MKV.`
            : first.errors[0]?.message ?? 'Dosya kabul edilmedi'
      setState({ kind: 'error', message: reason })
      return
    }
    if (accepted.length === 0) return
    setFile(accepted[0])
    setState({ kind: 'idle' })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: state.kind === 'uploading' || state.kind === 'processing',
  })

  const handleUpload = async () => {
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    if (matchId) form.append('matchId', matchId)

    setState({ kind: 'uploading', progress: 0 })

    // XHR ile progress yakalama (fetch native progress vermiyor)
    type UploadResponse = { videoId?: string; error?: string }
    const result = await new Promise<{ ok: boolean; data: UploadResponse }>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/video/upload')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100)
          setState({ kind: 'uploading', progress: pct })
        }
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, data })
        } catch {
          resolve({ ok: false, data: { error: 'Sunucu yanıtı okunamadı' } })
        }
      }
      xhr.onerror = () => resolve({ ok: false, data: { error: 'Ağ hatası' } })
      xhr.send(form)
    })

    if (!result.ok) {
      setState({ kind: 'error', message: result.data?.error ?? 'Yükleme başarısız' })
      return
    }

    const videoId = result.data.videoId
    if (!videoId) {
      setState({ kind: 'error', message: 'Sunucu video kimliği döndürmedi' })
      return
    }
    setState({ kind: 'processing', videoId, progress: 0 })
    subscribeProgress(videoId, setState)
  }

  const reset = () => {
    setFile(null)
    setState({ kind: 'idle' })
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        {...getRootProps()}
        className={cn(
          'flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-card/40 p-8 text-center transition-colors',
          isDragActive && 'border-primary bg-primary/5',
          (state.kind === 'uploading' || state.kind === 'processing') &&
            'cursor-not-allowed opacity-60',
        )}
        role="button"
        aria-label="Video dosyası seç veya sürükle bırak"
      >
        <input {...getInputProps()} aria-hidden />
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <Upload className="h-6 w-6 text-primary" aria-hidden />
        </div>
        {file ? (
          <div className="flex items-center gap-2">
            <FileVideo className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="font-mono text-sm">{file.name}</span>
            <span className="font-mono text-xs text-muted-foreground">
              ({formatSize(file.size)})
            </span>
          </div>
        ) : (
          <>
            <p className="text-base font-medium">
              {isDragActive ? 'Bırakabilirsin' : 'Video dosyasını buraya sürükle'}
            </p>
            <p className="text-xs text-muted-foreground">
              veya tıkla — MP4, MOV, AVI, MKV (max 2 GB)
            </p>
          </>
        )}
      </div>

      {file && state.kind === 'idle' && (
        <div className="flex gap-2">
          <button
            onClick={handleUpload}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="h-4 w-4" aria-hidden /> Yüklemeyi Başlat
          </button>
          <button
            onClick={reset}
            className="flex min-h-[44px] items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-accent/10"
            aria-label="Seçilen dosyayı kaldır"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {state.kind === 'uploading' && (
        <ProgressBar
          label={`Yükleniyor — %${state.progress}`}
          progress={state.progress}
          icon={<Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        />
      )}

      {state.kind === 'processing' && (
        <ProgressBar
          label={`AI analiz ediyor — %${state.progress}${state.stage ? ` (${state.stage})` : ''}`}
          progress={state.progress}
          icon={<Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        />
      )}

      {state.kind === 'done' && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Analiz tamamlandı.{' '}
          <a href={`/video/${state.videoId}`} className="underline">
            Sonuçlara git →
          </a>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" aria-hidden />
            {state.message}
          </span>
          <button
            onClick={reset}
            className="text-xs underline hover:no-underline"
          >
            Tekrar dene
          </button>
        </div>
      )}
    </div>
  )
}

function ProgressBar({
  label,
  progress,
  icon,
}: {
  label: string
  progress: number
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-card">
        <div
          className="h-full bg-primary transition-[width] duration-200"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

// Python sunucusunun WebSocket'ini dinler
function subscribeProgress(videoId: string, set: (s: UploadState) => void) {
  const wsUrl =
    (process.env.NEXT_PUBLIC_PYTHON_WS_URL ?? 'ws://localhost:8000') +
    `/ws/video/${videoId}`
  let ws: WebSocket
  try {
    ws = new WebSocket(wsUrl)
  } catch {
    set({ kind: 'error', message: 'Python sunucusuna bağlanılamadı' })
    return
  }
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data) as {
        status?: string
        progress?: number
        stage?: string
        message?: string
      }
      if (msg.status === 'done') {
        set({ kind: 'done', videoId })
        ws.close()
      } else if (msg.status === 'error') {
        set({ kind: 'error', message: msg.message ?? 'Analiz hatası' })
        ws.close()
      } else {
        set({
          kind: 'processing',
          videoId,
          progress: msg.progress ?? 0,
          stage: msg.stage,
        })
      }
    } catch {
      // Yok say
    }
  }
  ws.onerror = () => {
    set({ kind: 'error', message: 'Python sunucusu yanıt vermiyor' })
  }
}
