'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Play,
  Square,
  Video,
  AlertCircle,
  Circle,
  ClipboardList,
  Flame,
  Users,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  HeatmapToggle,
  LiveHeatmapOverlay,
  type HeatmapMode,
} from '@/components/match/LiveHeatmapOverlay'

const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL ?? 'http://localhost:8000'
const FRAME_INTERVAL_MS = 2000

interface LiveEvent {
  type: string
  minute: number
  second: number
  text: string
  details: Record<string, unknown>
}

// Sapma motorundan gelen taktik komut (Football Manager mantığı)
type CommandSeverity = 'RISK' | 'WARN' | 'OPPORTUNITY'

interface TacticalCommand {
  rule_id: string
  severity: CommandSeverity
  title: string
  text: string
  minute: number
  second: number
  details: Record<string, unknown>
}

// Komut UI'da kaç saniye görünür kalır
const COMMAND_DISPLAY_MS = 12000

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
    // Canlı ısı haritası overlay için (Python `zones_a/zones_b`)
    zones_a?: Record<string, number>
    zones_b?: Record<string, number>
  }
  ball_detected: boolean
  new_events: LiveEvent[]
  commands: TacticalCommand[]
  scoreboard: Scoreboard
}

interface MatchPlanInfo {
  name: string
  opponentName: string
  // Python /live/start gövdesine gönderilecek tam plan
  payload: Record<string, unknown>
}

export function LiveCameraBroadcast() {
  const searchParams = useSearchParams()
  const matchIdParam = searchParams.get('match')

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
  const [activeCommand, setActiveCommand] = useState<TacticalCommand | null>(null)
  const [commandHistory, setCommandHistory] = useState<TacticalCommand[]>([])
  const [lastMetrics, setLastMetrics] = useState<FrameResponse['metrics'] | null>(null)
  const [matchMinute, setMatchMinute] = useState<number>(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [planInfo, setPlanInfo] = useState<MatchPlanInfo | null>(null)
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>('off')
  // Maç bitince finish endpoint sonucu; UI'da rapor linki için
  const [finishStatus, setFinishStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'saved'; matchId: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const commandTimeoutRef = useRef<number | null>(null)

  // URL'de ?match=<id> varsa, ona ait kayıtlı planı çek
  useEffect(() => {
    if (!matchIdParam) {
      setPlanInfo(null)
      return
    }
    let aborted = false
    fetch(`/api/match/${matchIdParam}/plan`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (aborted || !data?.plan) {
          if (!aborted) setPlanInfo(null)
          return
        }
        const p = data.plan
        // Prisma JSON → Python MatchPlan.from_dict şekli (snake_case)
        const payload = {
          name: p.name,
          formation: p.formation,
          team_instructions: p.teamInstructions,
          player_assignments: p.playerAssignments ?? [],
          thresholds: p.thresholds,
          calibration: p.calibration ?? null,
          notes: p.notes ?? '',
        }
        setPlanInfo({
          name: p.name,
          opponentName: data.opponentName ?? 'Bilinmeyen',
          payload,
        })
      })
      .catch(() => {
        if (!aborted) setPlanInfo(null)
      })
    return () => {
      aborted = true
    }
  }, [matchIdParam])

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
    if (commandTimeoutRef.current !== null) {
      window.clearTimeout(commandTimeoutRef.current)
      commandTimeoutRef.current = null
    }
    if (videoRef.current?.srcObject instanceof MediaStream) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      videoRef.current.srcObject = null
    }
    const sid = sessionIdRef.current
    if (sid) {
      try {
        const stopRes = await fetch(`${PYTHON_API_URL}/live/stop/${sid}`, { method: 'POST' })
        // Plan'a bağlı oturumda (?match=<id>) → summary'i DB'ye yaz, uyum raporu link'i göster
        if (stopRes.ok && matchIdParam) {
          const stopData = (await stopRes.json()) as { summary?: unknown }
          if (stopData.summary) {
            try {
              const finishRes = await fetch(`/api/match/${matchIdParam}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ summary: stopData.summary }),
              })
              if (finishRes.ok) {
                setFinishStatus({ kind: 'saved', matchId: matchIdParam })
              } else {
                const err = (await finishRes.json().catch(() => ({}))) as { error?: string }
                setFinishStatus({
                  kind: 'error',
                  message: err.error ?? 'Maç kaydedilemedi',
                })
              }
            } catch (e) {
              setFinishStatus({
                kind: 'error',
                message: e instanceof Error ? e.message : 'Ağ hatası',
              })
            }
          }
        }
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
      // Sapma komutları — plana göre üretilen taktik uyarılar
      if (data.commands && data.commands.length > 0) {
        const cmd = data.commands[data.commands.length - 1]!
        setActiveCommand(cmd)
        setCommandHistory((prev) => [...prev.slice(-19), ...data.commands])
        if (commandTimeoutRef.current !== null) {
          window.clearTimeout(commandTimeoutRef.current)
        }
        commandTimeoutRef.current = window.setTimeout(
          () => setActiveCommand(null),
          COMMAND_DISPLAY_MS,
        )
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
      const startBody = planInfo
        ? { plan: planInfo.payload }
        : undefined
      const res = await fetch(`${PYTHON_API_URL}/live/start`, {
        method: 'POST',
        headers: startBody ? { 'Content-Type': 'application/json' } : undefined,
        body: startBody ? JSON.stringify(startBody) : undefined,
      })
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
  }, [selectedDeviceId, captureAndSend, stop, planInfo])

  const possession = scoreboard?.ball.possession
  const aPct = possession ? Math.round(possession.a * 100) : 0
  const bPct = possession ? Math.round(possession.b * 100) : 0
  const uPct = Math.max(0, 100 - aPct - bPct)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Video className="h-5 w-5 text-primary" aria-hidden />
        <div className="font-display text-base font-semibold">Canlı Kamera Yayını</div>
        {planInfo ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
            <ClipboardList className="h-3 w-3" aria-hidden />
            Plan: {planInfo.name} · vs {planInfo.opponentName}
          </span>
        ) : matchIdParam ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs text-warning">
            <AlertCircle className="h-3 w-3" aria-hidden /> Plan yüklenemedi · varsayılan eşikler
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Varsayılan eşikler (plan bağlı değil)
          </span>
        )}
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
            <>
              <HeatmapToggle mode={heatmapMode} onChange={setHeatmapMode} />
              <button
                onClick={() => void stop()}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Square className="h-4 w-4" aria-hidden /> Durdur
              </button>
            </>
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
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>{error}</span>
        </div>
      )}

      {finishStatus.kind === 'saved' && (
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm">
          <Sparkles className="h-4 w-4 text-success" aria-hidden />
          <span className="flex-1">Maç DB'ye kaydedildi.</span>
          <a
            href={`/match/${finishStatus.matchId}/uyum`}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Plan-Uyum Raporunu Aç
          </a>
        </div>
      )}

      {finishStatus.kind === 'error' && (
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <span>Maç sonu kaydı başarısız: {finishStatus.message}</span>
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

          {/* Isı haritası overlay — saha hâkimiyeti 3x3 grid (mode kapalı = render etmez) */}
          {running && (
            <LiveHeatmapOverlay
              zonesA={lastMetrics?.zones_a}
              zonesB={lastMetrics?.zones_b}
              mode={heatmapMode}
            />
          )}

          {!running && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-muted-foreground">
              Kamerayı sahaya/ekrana yönelt, "Başlat" tuşuna bas.
            </div>
          )}

          {/* Üst skor şeridi */}
          {running && scoreboard && (
            <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/85 via-black/60 to-transparent p-3">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-destructive px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-widest text-primary-foreground">
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
                    <div className="bg-destructive" style={{ width: `${bPct}%` }} />
                  </div>
                  <span className="font-mono font-semibold text-destructive">B %{bPct}</span>
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
              <div className="flex items-center gap-1.5">
                <span className="text-white/60">A</span>
                {lastMetrics.compactness_a.toFixed(0)}m
                <span className="text-white/40">·</span>
                <span className="text-white/60">B</span>
                {lastMetrics.compactness_b.toFixed(0)}m
              </div>
            </div>
          )}

          {/* Sapma komutu kartı — Football Manager mantığı, plana göre uyarı */}
          {running && activeCommand && (
            <TacticalCommandCard command={activeCommand} />
          )}
        </div>

        <div className="space-y-4">
          <CommandLogPanel commands={commandHistory} running={running} />
          <EventLogPanel events={scoreboard?.recent_events ?? []} running={running} />
        </div>
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
        <ol className="max-h-[240px] space-y-1.5 overflow-y-auto pr-1">
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

// Severity → renk + ikon eşleme (Football Manager kart hissi)
const SEVERITY_STYLE: Record<
  CommandSeverity,
  {
    icon: typeof ShieldAlert
    label: string
    bg: string
    border: string
    text: string
    chip: string
  }
> = {
  RISK: {
    icon: ShieldAlert,
    label: 'RİSK',
    bg: 'bg-destructive/15',
    border: 'border-destructive/60',
    text: 'text-destructive',
    chip: 'bg-destructive text-primary-foreground',
  },
  WARN: {
    icon: AlertTriangle,
    label: 'DİKKAT',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/60',
    text: 'text-amber-400',
    chip: 'bg-amber-500 text-black',
  },
  OPPORTUNITY: {
    icon: Sparkles,
    label: 'FIRSAT',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/60',
    text: 'text-emerald-400',
    chip: 'bg-emerald-500 text-black',
  },
}

function TacticalCommandCard({ command }: { command: TacticalCommand }) {
  const style = SEVERITY_STYLE[command.severity]
  const Icon = style.icon
  return (
    <div
      key={`${command.rule_id}-${command.minute}-${command.second}`}
      className={cn(
        'pointer-events-none absolute left-1/2 top-12 -translate-x-1/2',
        'animate-in fade-in slide-in-from-top-4 duration-300',
        'flex max-w-md items-center gap-3 rounded-lg border-2 px-4 py-2.5 shadow-xl backdrop-blur-sm',
        style.bg,
        style.border,
      )}
    >
      <Icon className={cn('h-6 w-6 shrink-0', style.text)} aria-hidden />
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
              style.chip,
            )}
          >
            {style.label}
          </span>
          <span className="font-mono text-[11px] text-white/80 tabular-nums">
            {String(command.minute).padStart(2, '0')}'
            {String(command.second).padStart(2, '0')}
          </span>
        </div>
        <div className="font-display text-base font-semibold leading-tight text-white">
          {command.title}
        </div>
        <div className="text-xs text-white/80">{command.text}</div>
      </div>
    </div>
  )
}

function CommandLogPanel({
  commands,
  running,
}: {
  commands: TacticalCommand[]
  running: boolean
}) {
  if (!running) {
    return (
      <aside className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Plana göre üretilen taktik uyarılar burada toplanır.
      </aside>
    )
  }
  return (
    <aside className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <ShieldAlert className="h-4 w-4 text-primary" aria-hidden />
        Sapma Uyarıları
      </h3>
      {commands.length === 0 ? (
        <p className="text-xs text-muted-foreground">Plana uyuluyor — uyarı yok.</p>
      ) : (
        <ol className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
          {[...commands].reverse().map((cmd, i) => {
            const style = SEVERITY_STYLE[cmd.severity]
            const Icon = style.icon
            return (
              <li
                key={`${cmd.rule_id}-${cmd.minute}-${cmd.second}-${i}`}
                className={cn(
                  'flex items-start gap-2 rounded-md border bg-background/40 px-2 py-1.5 text-xs',
                  style.border,
                )}
              >
                <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', style.text)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold tabular-nums">
                      {String(cmd.minute).padStart(2, '0')}'
                      {String(cmd.second).padStart(2, '0')}
                    </span>
                    <span className={cn('font-semibold', style.text)}>{cmd.title}</span>
                  </div>
                  <div className="truncate text-muted-foreground">{cmd.text}</div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}
