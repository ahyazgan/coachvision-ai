'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Users } from 'lucide-react'
import { Pitch } from './Pitch'
import {
  FORMATION_LIST,
  FORMATIONS,
  type Formation,
  type FormationId,
  type FormationSlot,
} from '@/lib/formations/presets'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PlacedToken extends FormationSlot {
  /** Stabil kimlik (sürükleme sırasında animasyonlar için). */
  id: string
  jerseyNumber: number
}

const GROUP_COLORS: Record<FormationSlot['group'], string> = {
  GK: 'bg-warning text-warning-foreground border-warning/60',
  DF: 'bg-primary/90 text-primary-foreground border-primary/60',
  MF: 'bg-success/90 text-success-foreground border-success/60',
  FW: 'bg-destructive text-destructive-foreground border-destructive/60',
}

function formationToTokens(formation: Formation): PlacedToken[] {
  return formation.slots.map((slot, i) => ({
    ...slot,
    id: `${formation.id}-${i}`,
    jerseyNumber: i === 0 ? 1 : i + 1,
  }))
}

/**
 * Saha üzerinde sürükle-bırak çalışan formasyon tahtası.
 * Pointer Events kullanılır (mouse + touch tek API).
 */
export function TacticsBoard() {
  const [formationId, setFormationId] = useState<FormationId>('4-3-3')
  const [tokens, setTokens] = useState<PlacedToken[]>(() =>
    formationToTokens(FORMATIONS['4-3-3']),
  )
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const pitchRef = useRef<HTMLDivElement | null>(null)

  // Formasyon değişince token'ları sıfırla
  useEffect(() => {
    setTokens(formationToTokens(FORMATIONS[formationId]))
  }, [formationId])

  const handleReset = useCallback(() => {
    setTokens(formationToTokens(FORMATIONS[formationId]))
  }, [formationId])

  // Sürükleme: sayfa boyu pointer dinleyicisi (token sınırı dışında bile takip etsin)
  useEffect(() => {
    if (!draggingId) return

    const moveToken = (clientX: number, clientY: number) => {
      const el = pitchRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 100
      const y = ((clientY - rect.top) / rect.height) * 100
      // 4-96 arası kısıtla — token'ın sahanın dışına taşmasını önle
      const clampedX = Math.max(4, Math.min(96, x))
      const clampedY = Math.max(4, Math.min(96, y))
      setTokens((prev) =>
        prev.map((t) => (t.id === draggingId ? { ...t, x: clampedX, y: clampedY } : t)),
      )
    }

    const handleMove = (e: PointerEvent) => moveToken(e.clientX, e.clientY)
    const handleEnd = () => setDraggingId(null)

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleEnd)
    window.addEventListener('pointercancel', handleEnd)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleEnd)
      window.removeEventListener('pointercancel', handleEnd)
    }
  }, [draggingId])

  return (
    <div className="space-y-4">
      {/* Üst kontroller */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FORMATION_LIST.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormationId(f.id)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                formationId === f.id
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {f.id}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-xs uppercase tracking-widest text-muted-foreground sm:inline">
            <Users className="mr-1 inline h-3 w-3" />
            11 oyuncu
          </span>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            Sıfırla
          </Button>
        </div>
      </div>

      {/* Saha + token'lar */}
      <div
        ref={pitchRef}
        className="relative mx-auto aspect-[2/3] w-full max-w-[560px] overflow-hidden rounded-lg border border-border bg-pitch shadow-lg"
        style={{ touchAction: 'none' }}
      >
        <Pitch className="absolute inset-0 h-full w-full" />

        {tokens.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              setDraggingId(t.id)
            }}
            initial={false}
            animate={{ left: `${t.x}%`, top: `${t.y}%` }}
            transition={{
              type: draggingId === t.id ? 'tween' : 'spring',
              duration: draggingId === t.id ? 0 : 0.4,
              stiffness: 300,
              damping: 25,
            }}
            className={cn(
              'absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab select-none flex-col items-center justify-center rounded-full border-2 text-xs font-bold shadow-md',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              draggingId === t.id && 'scale-110 cursor-grabbing shadow-2xl ring-2 ring-white/40',
              GROUP_COLORS[t.group],
            )}
            aria-label={`${t.role} - ${t.jerseyNumber} numara`}
          >
            <span className="stat-number text-base leading-none">{t.jerseyNumber}</span>
            <span className="text-[8px] font-medium leading-none opacity-90">{t.role}</span>
          </motion.button>
        ))}

        {/* Saha kenarındaki formasyon etiketi */}
        <div className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/40 px-2 py-1 font-mono text-xs uppercase tracking-widest text-white/90 backdrop-blur-sm">
          {formationId}
        </div>
      </div>

      {/* Açıklama */}
      <p className="text-center text-xs text-muted-foreground">
        Oyuncuları sürükleyip bırakarak konumlandırın · Formasyon değişikliği pozisyonları sıfırlar
      </p>
    </div>
  )
}
