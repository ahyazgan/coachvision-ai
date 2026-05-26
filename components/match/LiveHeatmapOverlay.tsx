'use client'

/**
 * Canlı yayın videosunun üstüne saha hâkimiyeti ısı haritası bindirir.
 *
 * 3x3 grid — Python pipeline'ın `zones_a` / `zones_b` çıktısıyla bire bir.
 * Her hücre takımın o bölgedeki anlık yoğunluğuyla parlar (mavi = A, kırmızı = B).
 * `both` mod ikisini de katmanlar; bir bölgede iki takımın çakışması = mücadele alanı.
 *
 * Toggle butonu LiveCameraBroadcast tarafında yönetilir.
 */

import { cn } from '@/lib/utils'

export type HeatmapMode = 'off' | 'A' | 'B' | 'both'

const ZONE_NAMES = [
  'top_left', 'top_center', 'top_right',
  'mid_left', 'mid_center', 'mid_right',
  'bot_left', 'bot_center', 'bot_right',
] as const

interface Props {
  zonesA: Record<string, number> | undefined
  zonesB: Record<string, number> | undefined
  mode: HeatmapMode
}

export function LiveHeatmapOverlay({ zonesA, zonesB, mode }: Props) {
  if (mode === 'off') return null
  if (!zonesA && !zonesB) return null

  // Maks değerlere göre normalize — yoğunluğun göreceli görünmesi için
  const aMax = Math.max(1, ...ZONE_NAMES.map((z) => zonesA?.[z] ?? 0))
  const bMax = Math.max(1, ...ZONE_NAMES.map((z) => zonesB?.[z] ?? 0))

  const showA = mode === 'A' || mode === 'both'
  const showB = mode === 'B' || mode === 'both'

  return (
    <div
      className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
      aria-hidden
    >
      {ZONE_NAMES.map((z) => {
        const aIntensity = zonesA ? (zonesA[z] ?? 0) / aMax : 0
        const bIntensity = zonesB ? (zonesB[z] ?? 0) / bMax : 0
        const aOpacity = showA && aIntensity > 0 ? 0.15 + aIntensity * 0.4 : 0
        const bOpacity = showB && bIntensity > 0 ? 0.15 + bIntensity * 0.4 : 0
        return (
          <div
            key={z}
            className="relative border border-white/5"
          >
            {aOpacity > 0 && (
              <div
                className="absolute inset-0 bg-primary"
                style={{ opacity: aOpacity }}
              />
            )}
            {bOpacity > 0 && (
              <div
                className="absolute inset-0 bg-destructive mix-blend-screen"
                style={{ opacity: bOpacity }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Toggle butonu — 4 mod arasında döner: off → A → B → both → off
 */
export function HeatmapToggle({
  mode,
  onChange,
}: {
  mode: HeatmapMode
  onChange: (m: HeatmapMode) => void
}) {
  const labels: Record<HeatmapMode, string> = {
    off: 'Isı: Kapalı',
    A: 'Isı: A',
    B: 'Isı: B',
    both: 'Isı: A+B',
  }
  const next: Record<HeatmapMode, HeatmapMode> = {
    off: 'A',
    A: 'B',
    B: 'both',
    both: 'off',
  }
  return (
    <button
      type="button"
      onClick={() => onChange(next[mode])}
      className={cn(
        'rounded-md border px-2 py-1 font-mono text-xs transition-colors',
        mode === 'off'
          ? 'border-border text-muted-foreground hover:text-foreground'
          : 'border-primary/50 bg-primary/10 text-primary',
      )}
    >
      {labels[mode]}
    </button>
  )
}
