'use client'

/**
 * Rakip diziliş tespiti kartı.
 *
 * "Tahmin et" → Python videodan 8 kare örnekler, B takımının Y koordinatlarını
 * K-means ile satırlara böler → "4-3-3 (güven %72)" gibi sonuç dön.
 *
 * Konvensiyon: A = ev sahibi (kendi takımın), B = rakip. Buton varsayılan
 * olarak B'yi analiz eder; istersen takımı değiştirebilirsin.
 */
import { useState } from 'react'
import { Loader2, Users2 } from 'lucide-react'

interface FormationResult {
  formation: string
  row_counts: number[]
  confidence: number
  frames_used: number
  total_player_samples: number
  notes: string
}

export function OpponentFormationCard({ videoId }: { videoId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<FormationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [team, setTeam] = useState<'A' | 'B'>('B')

  async function run() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/video/${videoId}/opponent-formation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleCount: 8, team }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Tahmin başarısız')
      }
      setResult(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bilinmeyen hata')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users2 className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="font-display text-base font-semibold">
          Diziliş Tahmini
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value as 'A' | 'B')}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="B">Rakip (B)</option>
            <option value="A">Ev sahibi (A)</option>
          </select>
          <button
            type="button"
            onClick={() => void run()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : null}
            Tahmin et
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-3xl font-bold text-primary">
              {result.formation}
            </span>
            <span className="text-xs text-muted-foreground">
              Güven %{(result.confidence * 100).toFixed(0)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {result.frames_used} kare · {result.total_player_samples} oyuncu örneği
            · {result.notes}
          </p>
        </div>
      )}

      {!result && !error && !loading && (
        <p className="mt-2 text-xs text-muted-foreground">
          Video başarıyla yüklendiyse 8 kare örneklenip kümeleme yapılır. 5-10
          saniye sürer.
        </p>
      )}
    </div>
  )
}
