'use client'

import { useState } from 'react'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'

interface Props {
  teamId: string
  limit: number
  enoughMatches: boolean
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; report: string; matchCount: number }
  | { kind: 'error'; message: string }

interface ReportResponse {
  report: string
  matchCount: number
}

interface ErrorResponse {
  error: string
}

export function ProgressReportCard({ teamId, limit, enoughMatches }: Props) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  const generate = async () => {
    setState({ kind: 'loading' })
    try {
      const res = await fetch(
        `/api/team/${teamId}/progress-report?limit=${limit}`,
        { method: 'POST' },
      )
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as ErrorResponse
        setState({
          kind: 'error',
          message: err.error ?? `Rapor üretilemedi (${res.status})`,
        })
        return
      }
      const data = (await res.json()) as ReportResponse
      setState({ kind: 'ready', report: data.report, matchCount: data.matchCount })
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Ağ hatası',
      })
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="font-display text-base font-semibold">Gelişim raporu</h3>
        </div>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={state.kind === 'loading' || !enoughMatches}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {state.kind === 'loading' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Üretiliyor…
            </>
          ) : state.kind === 'ready' ? (
            'Yeniden üret'
          ) : (
            'Raporu üret'
          )}
        </button>
      </div>

      {!enoughMatches && (
        <p className="text-xs text-muted-foreground">
          Trend yorumu için en az 2 analiz edilmiş maç gerekli.
        </p>
      )}

      {state.kind === 'idle' && enoughMatches && (
        <p className="text-xs text-muted-foreground">
          Claude son {limit} maçın metriklerini özetleyip eğilimi yorumlayacak.
          Yorum kısa ve gözlem niteliğindedir, karar verici değildir.
        </p>
      )}

      {state.kind === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      )}

      {state.kind === 'ready' && (
        <div className="space-y-2">
          <div className="whitespace-pre-line rounded-md border border-border bg-background/40 p-3 text-sm leading-relaxed">
            {state.report}
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {state.matchCount} maç · gözlem niteliğinde · {new Date().toLocaleTimeString('tr-TR')}
          </p>
        </div>
      )}
    </div>
  )
}
