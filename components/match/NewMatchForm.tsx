'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Save } from 'lucide-react'

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '5-3-2', '3-4-3']

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

export function NewMatchForm() {
  const router = useRouter()
  const [opponent, setOpponent] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [competition, setCompetition] = useState('Lig Maçı')
  const [formation, setFormation] = useState('4-3-3')
  const [venue, setVenue] = useState('')
  const [state, setState] = useState<SubmitState>({ kind: 'idle' })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (opponent.trim().length === 0) return
    setState({ kind: 'saving' })
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          awayTeamName: opponent.trim(),
          date: new Date(date).toISOString(),
          competition: competition.trim() || 'Maç',
          formation,
          venue: venue.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setState({
          kind: 'error',
          message: err.error ?? `Kaydedilemedi (${res.status})`,
        })
        return
      }
      const data = (await res.json()) as { id: string }
      // Plan sayfasına yönlendir — antrenör hemen plan kurabilsin
      router.push(`/match/${data.id}/plan`)
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Ağ hatası',
      })
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-5">
      <Field label="Rakip takım" required>
        <input
          type="text"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          required
          maxLength={80}
          placeholder="örn. Galatasaray"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tarih" required>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Diziliş">
          <select
            value={formation}
            onChange={(e) => setFormation(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Lig / yarışma">
          <input
            type="text"
            value={competition}
            onChange={(e) => setCompetition(e.target.value)}
            maxLength={80}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Saha (opsiyonel)">
          <input
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            maxLength={120}
            placeholder="örn. Ev sahası"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>

      {state.kind === 'error' && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Maç oluşunca otomatik plan editörüne yönleniriz.
        </p>
        <button
          type="submit"
          disabled={state.kind === 'saving' || opponent.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {state.kind === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Maçı Oluştur
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {children}
    </div>
  )
}
