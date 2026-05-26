'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, UserPlus, X } from 'lucide-react'

const POSITIONS: { value: 'GK' | 'DF' | 'MF' | 'FW'; label: string }[] = [
  { value: 'GK', label: 'Kaleci (GK)' },
  { value: 'DF', label: 'Defans (DF)' },
  { value: 'MF', label: 'Orta Saha (MF)' },
  { value: 'FW', label: 'Forvet (FW)' },
]

type State =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'error'; message: string }

export function AddPlayerDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('10')
  const [position, setPosition] = useState<'GK' | 'DF' | 'MF' | 'FW'>('MF')
  const [birthDate, setBirthDate] = useState('2000-01-01')
  const [nationality, setNationality] = useState('TUR')
  const [state, setState] = useState<State>({ kind: 'idle' })

  const reset = () => {
    setFirstName('')
    setLastName('')
    setJerseyNumber('10')
    setPosition('MF')
    setBirthDate('2000-01-01')
    setNationality('TUR')
    setState({ kind: 'idle' })
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState({ kind: 'saving' })
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          jerseyNumber: Number(jerseyNumber),
          position,
          birthDate,
          nationality: nationality.trim().toUpperCase().slice(0, 3) || undefined,
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
      router.refresh()
      close()
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Ağ hatası',
      })
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <UserPlus className="h-4 w-4" aria-hidden />
        Oyuncu Ekle
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={close}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Yeni Oyuncu</h2>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1 hover:bg-muted"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ad" required>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={50}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Soyad" required>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={50}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Forma No" required>
            <input
              type="number"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              required
              min={1}
              max={99}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-right font-mono text-sm"
            />
          </Field>
          <Field label="Pozisyon" required>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value as typeof position)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Doğum tarihi" required>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Uyruk (3 harf)">
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              maxLength={3}
              placeholder="TUR"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm uppercase"
            />
          </Field>
        </div>

        {state.kind === 'error' && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{state.message}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:text-foreground"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={state.kind === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {state.kind === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <UserPlus className="h-4 w-4" aria-hidden />
            )}
            Oyuncuyu Ekle
          </button>
        </div>
      </form>
    </div>
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
