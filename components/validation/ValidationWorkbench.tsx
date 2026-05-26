'use client'

/**
 * Doğrulama veri seti annotation ekranı.
 *
 * Akış:
 * 1. Saniye seç → "Frame Çıkar" → Python frame + sistem tespitlerini döner
 * 2. Görüntü <img> + üstüne SVG overlay
 *    - Sistem tespitleri: yarı saydam halka (mavi A / kırmızı B / gri null)
 *    - Sol tık: A takımı GT noktası ekle
 *    - Shift+sol tık: B takımı GT
 *    - Sağ tık: en yakın GT'yi sil
 * 3. Kaydet → POST sample
 * 4. Sağ panelde sample listesi + toplu precision/recall/team-accuracy
 *
 * Tüm koordinatlar normalize (0..1) saklanır.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, Layers, Loader2, Save, Sparkles, Target, Trash2 } from 'lucide-react'
import type { ValidationMetrics } from '@/lib/validation-metrics'

interface SystemDetection {
  x: number // 0..1
  y: number
  team: 'A' | 'B' | null
  confidence: number
}
interface GtPoint {
  x: number
  y: number
  team: 'A' | 'B'
}
interface SampleRecord {
  id: string
  frameTimeSec: number
  groundTruth: GtPoint[]
  systemOutput: SystemDetection[]
  imageWidth: number
  imageHeight: number
  createdAt: string
}
interface ExtractResponse {
  image_b64: string
  width: number
  height: number
  detections: SystemDetection[]
}

interface Props {
  videoId: string
  durationSec: number
}

export function ValidationWorkbench({ videoId, durationSec }: Props) {
  const [timeSec, setTimeSec] = useState(Math.min(60, durationSec / 2))
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [frame, setFrame] = useState<ExtractResponse | null>(null)
  const [gt, setGt] = useState<GtPoint[]>([])
  const [samples, setSamples] = useState<SampleRecord[]>([])
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null)
  const [showSystem, setShowSystem] = useState(true)
  // Batch kuyruk modu — bir defada N frame planla, kullanıcı sırayla işaretler
  const [batchQueue, setBatchQueue] = useState<number[]>([])
  const [batchStart, setBatchStart] = useState(30)
  const [batchInterval, setBatchInterval] = useState(30)
  const [batchCount, setBatchCount] = useState(10)

  useEffect(() => {
    void refreshSamples()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshSamples() {
    try {
      const res = await fetch(`/api/video/${videoId}/validate`)
      if (!res.ok) return
      const data = (await res.json()) as {
        samples: SampleRecord[]
        metrics: ValidationMetrics
      }
      setSamples(data.samples)
      setMetrics(data.metrics)
    } catch {
      // sessiz — bilgi paneli boş kalır
    }
  }

  async function extract(targetSec?: number) {
    const sec = targetSec ?? timeSec
    setExtracting(true)
    setError(null)
    try {
      const res = await fetch(`/api/video/${videoId}/validate/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSec: sec }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Frame çıkarılamadı')
      }
      const data = (await res.json()) as ExtractResponse
      setFrame(data)
      setGt([]) // yeni frame için temiz başlangıç
      if (targetSec !== undefined) setTimeSec(sec)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata')
    } finally {
      setExtracting(false)
    }
  }

  function startBatch() {
    const queue: number[] = []
    for (let i = 0; i < batchCount; i++) {
      const t = batchStart + i * batchInterval
      if (t > durationSec) break
      queue.push(t)
    }
    if (queue.length === 0) return
    setBatchQueue(queue)
    // İlk öğeyi hemen çıkar
    const [first, ...rest] = queue
    setBatchQueue(rest)
    void extract(first)
  }

  function skipBatch() {
    if (batchQueue.length === 0) return
    const [next, ...rest] = batchQueue
    setBatchQueue(rest)
    void extract(next)
  }

  function clearBatch() {
    setBatchQueue([])
  }

  async function save() {
    if (!frame || gt.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/video/${videoId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameTimeSec: timeSec,
          groundTruth: gt,
          systemOutput: frame.detections,
          imageWidth: frame.width,
          imageHeight: frame.height,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Kaydedilemedi')
      }
      setFrame(null)
      setGt([])
      await refreshSamples()
      // Batch modunda otomatik bir sonraki frame'e geç
      if (batchQueue.length > 0) {
        const [next, ...rest] = batchQueue
        setBatchQueue(rest)
        void extract(next)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSample(id: string) {
    if (!confirm('Bu sample silinsin mi?')) return
    const res = await fetch(`/api/video/${videoId}/validate/${id}`, {
      method: 'DELETE',
    })
    if (res.ok) await refreshSamples()
  }

  function handleCanvasClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!frame) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    const team: 'A' | 'B' = e.shiftKey ? 'B' : 'A'
    setGt((prev) => [...prev, { x, y, team }])
  }

  function handleCanvasContextMenu(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault()
    if (!frame || gt.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    let nearestIdx = 0
    let nearestD = Infinity
    gt.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2
      if (d < nearestD) {
        nearestD = d
        nearestIdx = i
      }
    })
    setGt((prev) => prev.filter((_, i) => i !== nearestIdx))
  }

  const hasFrame = frame !== null

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* SOL — annotation canvas */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
          <label className="flex-1 space-y-1 text-xs">
            <span className="text-muted-foreground">
              Saniye (0 — {Math.round(durationSec)})
            </span>
            <input
              type="number"
              min={0}
              max={durationSec}
              step={0.5}
              value={timeSec}
              onChange={(e) => setTimeSec(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void extract()}
            disabled={extracting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            Frame çıkar
          </button>
          {batchQueue.length > 0 && (
            <span className="rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
              Batch: {batchQueue.length} frame kuyrukta
            </span>
          )}
          {hasFrame && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={showSystem}
                onChange={(e) => setShowSystem(e.target.checked)}
              />
              Sistem tespitlerini göster
            </label>
          )}
        </div>

        <details className="rounded-lg border border-border bg-card p-4 text-sm">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4 text-primary" aria-hidden />
            Toplu mod — N frame'i kuyruğa al
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Başlangıç (s)</span>
              <input
                type="number"
                min={0}
                max={durationSec}
                value={batchStart}
                onChange={(e) => setBatchStart(Math.max(0, Number(e.target.value)))}
                className="w-full rounded-md border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Aralık (s)</span>
              <input
                type="number"
                min={1}
                value={batchInterval}
                onChange={(e) => setBatchInterval(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-md border border-border bg-background px-2 py-1"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Adet</span>
              <input
                type="number"
                min={1}
                max={50}
                value={batchCount}
                onChange={(e) =>
                  setBatchCount(Math.max(1, Math.min(50, Number(e.target.value))))
                }
                className="w-full rounded-md border border-border bg-background px-2 py-1"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={startBatch}
                disabled={extracting || batchQueue.length > 0}
                className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Başlat
              </button>
              {batchQueue.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={skipBatch}
                    title="Bu frame'i atla, sonrakine geç"
                    className="rounded-md border border-border px-2 py-1.5 text-xs hover:text-primary"
                  >
                    <ChevronRight className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={clearBatch}
                    title="Kuyruğu temizle"
                    className="rounded-md border border-border px-2 py-1.5 text-xs hover:text-destructive"
                  >
                    İptal
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Kaydet'e bastıkça sıradaki frame otomatik gelir. 30 saniyede bir 10
            frame önerilir — 5 dk'lık kesit için yeterli kapsama.
          </p>
        </details>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {hasFrame ? (
          <div className="space-y-2">
            <div className="relative w-full overflow-hidden rounded-lg border border-border bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={frame.image_b64}
                alt={`Frame ${timeSec}s`}
                className="block w-full select-none"
                draggable={false}
              />
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full cursor-crosshair"
                onClick={handleCanvasClick}
                onContextMenu={handleCanvasContextMenu}
              >
                {showSystem &&
                  frame.detections.map((d, i) => (
                    <circle
                      key={`sys-${i}`}
                      cx={d.x}
                      cy={d.y}
                      r={0.015}
                      fill="none"
                      strokeWidth={0.003}
                      stroke={
                        d.team === 'A'
                          ? '#60a5fa'
                          : d.team === 'B'
                            ? '#f87171'
                            : '#9ca3af'
                      }
                      opacity={0.85}
                    />
                  ))}
                {gt.map((p, i) => (
                  <g key={`gt-${i}`}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={0.008}
                      fill={p.team === 'A' ? '#2563eb' : '#dc2626'}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={0.012}
                      fill="none"
                      strokeWidth={0.0015}
                      stroke="white"
                      opacity={0.9}
                    />
                  </g>
                ))}
              </svg>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>Sol tık: <b className="text-primary">A takımı</b></span>
              <span>Shift+sol tık: <b className="text-destructive">B takımı</b></span>
              <span>Sağ tık: en yakın GT'yi sil</span>
              <span className="ml-auto">
                {gt.length} GT · {frame.detections.length} sistem
              </span>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || gt.length === 0}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                Sample'ı kaydet
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            <Target className="mx-auto mb-3 h-8 w-8 opacity-50" aria-hidden />
            Bir saniye seçip "Frame çıkar" butonuna bas. Sistem o anki tespitleri
            gösterecek, sen üzerine gerçek oyuncuları işaretleyeceksin.
          </div>
        )}
      </div>

      {/* SAĞ — metrik + sample listesi */}
      <aside className="space-y-4">
        <MetricsPanel metrics={metrics} />
        <SamplesList
          samples={samples}
          onDelete={(id) => void deleteSample(id)}
        />
      </aside>
    </div>
  )
}

function MetricsPanel({ metrics }: { metrics: ValidationMetrics | null }) {
  const empty = !metrics || metrics.sampleCount === 0
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-display text-base font-semibold">Birikmiş Metrikler</h2>
      {empty ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Henüz sample yok. En az 5-10 sample biriksin sonra rakamlar anlamlı olur.
        </p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          <MetricRow label="Sample sayısı" value={metrics.sampleCount.toString()} />
          <MetricRow
            label="Precision"
            value={`${(metrics.precision * 100).toFixed(1)}%`}
            hint={`${metrics.truePositives} TP / ${metrics.truePositives + metrics.falsePositives} tespit`}
          />
          <MetricRow
            label="Recall"
            value={`${(metrics.recall * 100).toFixed(1)}%`}
            hint={`${metrics.truePositives} TP / ${metrics.truePositives + metrics.falseNegatives} GT`}
          />
          <MetricRow
            label="F1"
            value={`${(metrics.f1 * 100).toFixed(1)}%`}
          />
          <MetricRow
            label="Takım doğruluğu"
            value={`${(metrics.teamAccuracy * 100).toFixed(1)}%`}
            hint={`${metrics.teamComparable} eşleşmiş çift`}
          />
        </dl>
      )}
    </div>
  )
}

function MetricRow({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <span className="font-mono font-semibold tabular-nums">{value}</span>
        {hint && (
          <div className="text-[10px] text-muted-foreground">{hint}</div>
        )}
      </dd>
    </div>
  )
}

function SamplesList({
  samples,
  onDelete,
}: {
  samples: SampleRecord[]
  onDelete: (id: string) => void
}) {
  const sorted = useMemo(
    () => [...samples].sort((a, b) => a.frameTimeSec - b.frameTimeSec),
    [samples],
  )
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="font-display text-base font-semibold">Sample'lar</h2>
      {sorted.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">Liste boş.</p>
      ) : (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
          {sorted.map((s) => {
            const gt = (s.groundTruth as unknown as GtPoint[]).length
            const sys = (s.systemOutput as unknown as SystemDetection[]).length
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1"
              >
                <span className="font-mono tabular-nums">
                  {s.frameTimeSec.toFixed(1)}s
                </span>
                <span className="text-muted-foreground">
                  GT {gt} · Sis {sys}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(s.id)}
                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                  aria-label="Sil"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
