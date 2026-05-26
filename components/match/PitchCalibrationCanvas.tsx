'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, RotateCcw, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Point {
  x: number // image natural piksel
  y: number
}

interface Props {
  matchId: string
  previewPath: string
  hasExisting: boolean
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; sampleDistance?: number }
  | { kind: 'error'; message: string }

const POINT_LABELS = ['Sol-Üst', 'Sağ-Üst', 'Sağ-Alt', 'Sol-Alt']

export function PitchCalibrationCanvas({ matchId, previewPath, hasExisting }: Props) {
  const router = useRouter()
  const imgRef = useRef<HTMLImageElement>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null)
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })

  // Naturel boyut img.onLoad'da set olur
  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    if (img.complete && img.naturalWidth > 0) {
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }, [])

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (points.length >= 4) return
    const img = imgRef.current
    if (!img || img.naturalWidth === 0) return
    const rect = img.getBoundingClientRect()
    const sx = (e.clientX - rect.left) / rect.width
    const sy = (e.clientY - rect.top) / rect.height
    if (sx < 0 || sx > 1 || sy < 0 || sy > 1) return
    const x = sx * img.naturalWidth
    const y = sy * img.naturalHeight
    setPoints([...points, { x, y }])
    setSaveState({ kind: 'idle' })
  }

  const reset = () => {
    setPoints([])
    setSaveState({ kind: 'idle' })
  }

  const undo = () => {
    setPoints(points.slice(0, -1))
    setSaveState({ kind: 'idle' })
  }

  const save = async () => {
    if (points.length !== 4) return
    setSaveState({ kind: 'saving' })
    try {
      const res = await fetch(`/api/match/${matchId}/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_points: points.map((p) => [p.x, p.y]),
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setSaveState({
          kind: 'error',
          message: err.error ?? `Kaydedilemedi (${res.status})`,
        })
        return
      }
      const data = (await res.json()) as { sample_distance_m?: number }
      setSaveState({ kind: 'saved', sampleDistance: data.sample_distance_m })
      router.refresh()
    } catch (e) {
      setSaveState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Ağ hatası',
      })
    }
  }

  const remove = async () => {
    setSaveState({ kind: 'saving' })
    try {
      const res = await fetch(`/api/match/${matchId}/calibration`, { method: 'DELETE' })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setSaveState({
          kind: 'error',
          message: err.error ?? 'Silinemedi',
        })
        return
      }
      setPoints([])
      setSaveState({ kind: 'idle' })
      router.refresh()
    } catch (e) {
      setSaveState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Ağ hatası',
      })
    }
  }

  return (
    <div className="space-y-4">
      <Instructions step={points.length} hasExisting={hasExisting} />

      <div
        onClick={handleClick}
        className={cn(
          'relative w-full cursor-crosshair overflow-hidden rounded-lg border-2 border-border bg-black',
          points.length === 4 && 'cursor-default border-success/60',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={previewPath}
          alt="Saha referans karesi"
          className="block w-full select-none"
          onLoad={(e) => {
            const img = e.currentTarget
            setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
          }}
          draggable={false}
        />

        {naturalSize && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox={`0 0 ${naturalSize.w} ${naturalSize.h}`}
            preserveAspectRatio="none"
          >
            {/* 4 nokta varsa aralarına trapez çiz */}
            {points.length === 4 && (
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="hsl(var(--primary) / 0.15)"
                stroke="hsl(var(--primary))"
                strokeWidth={Math.max(2, naturalSize.w / 400)}
              />
            )}
            {points.map((p, i) => (
              <g key={i}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={Math.max(8, naturalSize.w / 100)}
                  fill="hsl(var(--primary))"
                  stroke="white"
                  strokeWidth={Math.max(2, naturalSize.w / 500)}
                />
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={Math.max(12, naturalSize.w / 80)}
                  fontWeight="bold"
                  className="select-none"
                >
                  {i + 1}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <SaveStatus state={saveState} />

        <div className="flex items-center gap-2">
          {hasExisting && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saveState.kind === 'saving'}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Kalibrasyonu sil
            </button>
          )}
          <button
            type="button"
            onClick={undo}
            disabled={points.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Geri al
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={points.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:text-foreground disabled:opacity-50"
          >
            Sıfırla
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={points.length !== 4 || saveState.kind === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saveState.kind === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            Kaydet ({points.length}/4)
          </button>
        </div>
      </div>
    </div>
  )
}

function Instructions({ step, hasExisting }: { step: number; hasExisting: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 font-display text-base font-semibold">Nasıl kalibre ediyoruz?</h3>
      <ol className="space-y-1 text-sm text-muted-foreground">
        <li>
          <span className="font-mono text-primary">1.</span> Sahanın <strong>sol-üst köşesini</strong> tıkla (kaleci kalesinin solu)
        </li>
        <li>
          <span className="font-mono text-primary">2.</span> Sonra <strong>sağ-üst</strong> köşesini
        </li>
        <li>
          <span className="font-mono text-primary">3.</span> Sonra <strong>sağ-alt</strong> köşesini
        </li>
        <li>
          <span className="font-mono text-primary">4.</span> Son olarak <strong>sol-alt</strong> köşesini
        </li>
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Sıra önemli — saat yönü. Köşeler görünmüyorsa görünebilen iki köşe + iki çizgi
        kesişimi (örn. yan çizgi + orta çizgi) de işe yarar.
        {hasExisting && (
          <span className="ml-1 text-warning">
            Bu maçta zaten kalibrasyon var; yeni kaydedersen eski silinir.
          </span>
        )}
        <br />
        <span className="font-mono">Şu an: {step}/4 nokta seçildi</span>
        {step > 0 && step < 4 && (
          <span className="ml-1 text-primary">— sırada: {POINT_LABELS[step]}</span>
        )}
      </p>
    </div>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state.kind === 'idle') {
    return (
      <span className="text-xs text-muted-foreground">
        4 noktayı seç → Kaydet'e bas → homografi hesaplanır
      </span>
    )
  }
  if (state.kind === 'saving') {
    return <span className="text-xs text-muted-foreground">Doğrulanıyor…</span>
  }
  if (state.kind === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-success">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Kalibrasyon kaydedildi
        {state.sampleDistance != null && (
          <span className="font-mono text-muted-foreground">
            (üst kenar ~{state.sampleDistance}m)
          </span>
        )}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5" aria-hidden />
      {state.message}
    </span>
  )
}
