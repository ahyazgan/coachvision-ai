'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Play, Square, Video, AlertCircle, Circle, Flame, Users } from 'lucide-react'

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? 'http://localhost:8000'
const FRAME_INTERVAL_MS = 2000

interface LiveEvent {
  type: string
  minute: number
  second: number
  text: string
  details: Record<string, unknown>
}

interface Scoreboard {
  session_id: string
  frames_processed: number
  elapsed_sec: number
  ball: {
    frames_with_ball: number
    visibility: number
    possession: { a: number; b: number; unknown: number }
    zone_counts: Record<string, number>
  }
  events_total: number
  recent_events: LiveEvent[]
}

interface FrameResponse {
  session_id: string
  frame_count: number
  match_minute: number
  metrics: {
    player_count_a: number
    player_count_b: number
    compactness_a: number
    compactness_b: number
    pressure_score: number
    outlier_count: number
  }
  ball_detected: boolean
  new_events: LiveEvent[]
  scoreboard: Scoreboard
}

export function LiveCameraBroadcast() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const intervalRef = useRef<number | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const tickerTimeoutRef = useRef<number | null>(null)

  const [running, setRunning] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scoreboard, setScoreboard] = useState<Scoreboard | null>(null)
  const [tickerEvent, setTickerEvent] = useState<LiveEvent | null>(null)
  const [lastMetrics, setLastMetrics] = useState<FrameResponse['metrics'] | null>(null)
  const [matchMinute, setMatchMinute] = useState<number>(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')

  // Kamera listesini bir kez çek (izin gerekmez, sadece etiketler boş gelebilir)
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices
      .enumerateDevices()
      .then((list) => {
        const cams = list.filter((d) => d.kind === 'videoinput')
        setDevices(cams)
        if (cams[0] && !selectedDeviceId) setSelectedDeviceId(cams[0].deviceId)
      })
      .catch(() => {})
  }, [selectedDeviceId])

  const stop = useCallback(async () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (tickerTimeoutRef.current !== null) {
      window.clearTimeout(tickerTimeoutRef.current)
      tickerTimeoutRef.current = null
    }
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
    const sid = sessionIdRef.current
    if (sid) {
      try {
        await fetch(`${PYTHON_API_URL}/live/stop/${sid}`, { method: 'POST' })
      } catch {
        // sessizce yut
      }
      sessionIdRef.current = null
    }
    setRunning(false)
  }, [])

  // Component unmount → temizlik
  useEffect(() => {
    return () => {
      void stop()
    }
  }, [stop])

  const captureAndSend = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const sid = sessionIdRef.current
    if (!video || !canvas || !sid || video.readyState < 2) return

    // Bellek için maks 1280 genişlik — Python tarafı zaten 1280px inference yapıyor
    const maxW = 1280
    const scale = Math.min(1, maxW / video.videoWidth)
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob) return

    try {
      const fd = new FormData()
      fd.append('file', blob, 'frame.jpg')
      const res = await fetch(`${PYTHON_API_URL}/live/frame/${sid}`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) return
      const data: FrameResponse = await res.json()
      setScoreboard(data.scoreboard)
      setLastMetrics(data.metrics)
      setMatchMinute(data.match_minute)
      if (data.new_events.length > 0) {
        const ev = data.new_events[data.new_events.length - 1]!
        setTickerEvent(ev)
        if (tickerTimeoutRef.current !== null) {
          window.clearTimeout(tickerTimeoutRef.current)
        }
        // Ticker 8 saniye sonra otomatik kaybolur
        tickerTimeoutRef.current = window.setTimeout(() => setTickerEvent(null), 8000)
      }
    } catch {
      // sessizce yut — geçici ağ hatası
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const res = await fetch(`${PYTHON_API_URL}/live/start`, { method: 'POST' })
      if (!res.ok) throw new Error('Sunucu oturumu açılamadı (Python servisi çalışıyor mu?)')
      const data = (await res.json()) as { session_id: string }
      sessionIdRef.current = data.session_id
      intervalRef.current = window.setInterval(() => {
        void captureAndSend()
      }, FRAME_INTERVAL_MS)
      setRunning(true)
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : 'Kamera açılamadı — tarayıcı izni reddedilmiş olabilir.'
      setError(msg)
      await stop()
    } finally {
      setStarting(false)
    }
  }, [selectedDeviceId, captureAndSend, stop])

  const possession = scoreboard?.ball.possession
  const aPct = possession ? Math.round(possession.a * 100) : 0
  const bPct = possession ? Math.round(possession.b * 100) : 0
  const uPct = Math.max(0, 100 - aPct - bPct)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Video className="h-5 w-5 text-primary" aria-hidden />
        <div className="font-display text-base font-semibold">Canlı Kamera Yayını</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!running && (
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={starting}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            >
              {devices.length === 0 ? (
                <option value="">Kamera bulunamadı</option>
              ) : (
                devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Kamera ${i + 1}`}
                  </option>
                ))
              )}
            </select>
          )}
          {running ? (
            <button
              onClick={() => void stop()}
              className="inline-flex items-center gap-1.5 rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Square className="h-4 w-4" aria-hidden /> Durdur
            </button>
          ) : (
            <button
              onClick={() => void start()}
              disabled={starting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Play className="h-4 w-4" aria-hidden /> {starting ? 'Açılıyor…' : 'Başlat'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-lg border border-border bg-black">
          {/* Canlı video */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-video w-full bg-black object-contain"
          />

          {!running && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-muted-foreground">
              Kamerayı sahaya/ekrana yönelt, "Başlat" tuşuna bas.
            </div>
          )}

          {/* Üst skor şeridi */}
          {running && scoreboard && (
            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/60 to-transparent p-3">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-danger px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-primary-foreground">
                  ● Canlı
                </span>
                <span className="font-mono text-base font-bold text-white tabular-nums">
                  {String(matchMinute).padStart(2, '0')}'
                </span>
                <div className="flex flex-1 items-center gap-2 text-xs text-white">
                  <span className="font-mono font-semibold text-primary">A %{aPct}</span>
                  <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div className="bg-primary" style={{ width: `${aPct}%` }} />
                    <div className="bg-white/40" style={{ width: `${uPct}%` }} />
                    <div className="bg-danger" style={{ width: `${bPct}%` }} />
                  </div>
                  <span className="font-mono font-semibold text-danger">B %{bPct}</span>
                </div>
                <span className="font-mono text-[11px] text-white/70 tabular-nums">
                  frame {scoreboard.frames_processed}
                </span>
              </div>
            </div>
          )}

          {/* Alt event ticker */}
          {running && tickerEvent && (
            <div
              key={`${tickerEvent.minute}-${tickerEvent.second}-${tickerEvent.type}`}
              className="pointer-events-none absolute inset-x-0 bottom-0 animate-in fade-in slide-in-from-bottom-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 duration-300"
            >
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-primary px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-primary-foreground">
                  {String(tickerEvent.minute).padStart(2, '0')}'
                  {String(tickerEvent.second).padStart(2, '0')}
                </span>
                <span className="text-base font-semibold text-white">{tickerEvent.text}</span>
              </div>
            </div>
          )}

          {/* Anlık metrikler (sağ üst) */}
          {running && lastMetrics && (
            <div className="pointer-events-none absolute right-3 top-14 space-y-1 rounded-md bg-black/70 px-2 py-1.5 font-mono text-[11px] text-white">
              <div className="flex items-center gap-1.5">
                <Users className="h-3 w-3" aria-hidden />
                {lastMetrics.player_count_a} · {lastMetrics.player_count_b}
              </div>
              <div className="flex items-center gap-1.5">
                <Flame className="h-3 w-3" aria-hidden />
                pres {lastMetrics.pressure_score.toFixed(0)}
              </div>
              <div className="flex items-center gap-1.5">
                <Circle className="h-3 w-3" aria-hidden />
                {scoreboard ? `${Math.round(scoreboard.ball.visibility * 100)}%` : '—'}
              </div>
            </div>
          )}
        </div>

        <EventLogPanel events={scoreboard?.recent_events ?? []} running={running} />
      </div>

      {/* Frame yakalama için gizli canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </section>
  )
}

function EventLogPanel({ events, running }: { events: LiveEvent[]; running: boolean }) {
  if (!running) {
    return (
      <aside className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Yayın başlatıldığında olaylar burada akar.
      </aside>
    )
  }
  return (
    <aside className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Olay Akışı</h3>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Henüz olay yok.</p>
      ) : (
        <ol className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
          {[...events].reverse().map((ev, i) => (
            <li
              key={`${ev.minute}-${ev.second}-${ev.type}-${i}`}
              className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-2 py-1.5 text-xs"
            >
              <span className="font-mono font-semibold tabular-nums">
                {String(ev.minute).padStart(2, '0')}'
                {String(ev.second).padStart(2, '0')}
              </span>
              <span className="font-medium">{ev.text}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
