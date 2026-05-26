'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Loader2, RotateCcw, Save } from 'lucide-react'
import { cn } from '@/lib/utils'

// =============================================================================
// Tipler — Python match_plan.MatchPlan dataclass'ıyla bire bir uyumlu
// =============================================================================

interface TeamInstructions {
  defensive_line: 'low' | 'mid' | 'high'
  pressing: 'low' | 'mid' | 'high'
  possession_style: 'build_up' | 'balanced' | 'direct'
  width: 'narrow' | 'balanced' | 'wide'
  tempo: 'slow' | 'medium' | 'fast'
  notes: string
}

interface Thresholds {
  compactness_max_m: number
  compactness_min_m: number
  pressure_min_self: number
  pressure_max_opponent: number
  wing_imbalance_max: number
  possession_min_self: number
}

export interface PlanPayload {
  name: string
  formation: string
  teamInstructions: TeamInstructions
  thresholds: Thresholds
  notes: string
}

// =============================================================================
// Varsayılanlar — Python `match_plan.MatchPlan.default()` ile aynı değerler
// =============================================================================

const DEFAULT_TEAM_INSTRUCTIONS: TeamInstructions = {
  defensive_line: 'mid',
  pressing: 'mid',
  possession_style: 'balanced',
  width: 'balanced',
  tempo: 'medium',
  notes: '',
}

const DEFAULT_THRESHOLDS: Thresholds = {
  compactness_max_m: 38,
  compactness_min_m: 18,
  pressure_min_self: 30,
  pressure_max_opponent: 70,
  wing_imbalance_max: 0.6,
  possession_min_self: 0.4,
}

const FORMATIONS = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '5-3-2', '3-4-3', '4-3-1-2', '4-1-2-1-2']

// =============================================================================
// Form
// =============================================================================

interface Props {
  matchId: string
  opponentName: string
  initial: PlanPayload | null
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

export function MatchPlanForm({ matchId, opponentName, initial }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanPayload>(
    initial ?? {
      name: `${opponentName} maç planı`,
      formation: '4-3-3',
      teamInstructions: DEFAULT_TEAM_INSTRUCTIONS,
      thresholds: DEFAULT_THRESHOLDS,
      notes: '',
    },
  )
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })

  const setInstr = <K extends keyof TeamInstructions>(key: K, value: TeamInstructions[K]) => {
    setPlan((p) => ({ ...p, teamInstructions: { ...p.teamInstructions, [key]: value } }))
    setSaveState({ kind: 'idle' })
  }
  const setThr = <K extends keyof Thresholds>(key: K, value: number) => {
    setPlan((p) => ({ ...p, thresholds: { ...p.thresholds, [key]: value } }))
    setSaveState({ kind: 'idle' })
  }

  const resetThresholds = () => {
    setPlan((p) => ({ ...p, thresholds: { ...DEFAULT_THRESHOLDS } }))
    setSaveState({ kind: 'idle' })
  }

  const save = async () => {
    setSaveState({ kind: 'saving' })
    try {
      const res = await fetch(`/api/match/${matchId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        setSaveState({
          kind: 'error',
          message: err.error ?? `Kaydedilemedi (${res.status})`,
        })
        return
      }
      setSaveState({ kind: 'saved' })
      router.refresh()
    } catch (e) {
      setSaveState({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Ağ hatası',
      })
    }
  }

  return (
    <div className="space-y-6">
      <PlanIdentity plan={plan} onChange={(p) => { setPlan(p); setSaveState({ kind: 'idle' }) }} />
      <TeamInstructionsSection instructions={plan.teamInstructions} onChange={setInstr} />
      <ThresholdsSection
        thresholds={plan.thresholds}
        onChange={setThr}
        onReset={resetThresholds}
      />

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notlar
        </label>
        <textarea
          value={plan.notes}
          onChange={(e) => { setPlan({ ...plan, notes: e.target.value }); setSaveState({ kind: 'idle' }) }}
          rows={3}
          maxLength={1000}
          placeholder="Maça özel taktik notları (örn. 'Rakip 9 numara markaja al')"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-lg">
        <SaveStatus state={saveState} />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saveState.kind === 'saving'}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saveState.kind === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Planı Kaydet
        </button>
      </div>
    </div>
  )
}

// =============================================================================
// Alt bölümler
// =============================================================================

function PlanIdentity({
  plan,
  onChange,
}: {
  plan: PlanPayload
  onChange: (p: PlanPayload) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-base font-semibold">Plan Kimliği</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Plan adı">
          <input
            type="text"
            value={plan.name}
            onChange={(e) => onChange({ ...plan, name: e.target.value })}
            maxLength={100}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Diziliş">
          <select
            value={plan.formation}
            onChange={(e) => onChange({ ...plan, formation: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </div>
  )
}

function TeamInstructionsSection({
  instructions,
  onChange,
}: {
  instructions: TeamInstructions
  onChange: <K extends keyof TeamInstructions>(key: K, value: TeamInstructions[K]) => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-base font-semibold">Takım Talimatları</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Defansif çizgi"
          value={instructions.defensive_line}
          onChange={(v) => onChange('defensive_line', v as TeamInstructions['defensive_line'])}
          options={[
            { value: 'low', label: 'Düşük (geride)' },
            { value: 'mid', label: 'Orta' },
            { value: 'high', label: 'Yüksek (önde)' },
          ]}
        />
        <SelectField
          label="Pres yoğunluğu"
          value={instructions.pressing}
          onChange={(v) => onChange('pressing', v as TeamInstructions['pressing'])}
          options={[
            { value: 'low', label: 'Düşük' },
            { value: 'mid', label: 'Orta' },
            { value: 'high', label: 'Yüksek' },
          ]}
        />
        <SelectField
          label="Sahiplenme stili"
          value={instructions.possession_style}
          onChange={(v) =>
            onChange('possession_style', v as TeamInstructions['possession_style'])
          }
          options={[
            { value: 'build_up', label: 'Yapılandırma (oyun kurma)' },
            { value: 'balanced', label: 'Dengeli' },
            { value: 'direct', label: 'Direkt' },
          ]}
        />
        <SelectField
          label="Genişlik"
          value={instructions.width}
          onChange={(v) => onChange('width', v as TeamInstructions['width'])}
          options={[
            { value: 'narrow', label: 'Dar' },
            { value: 'balanced', label: 'Dengeli' },
            { value: 'wide', label: 'Geniş' },
          ]}
        />
        <SelectField
          label="Tempo"
          value={instructions.tempo}
          onChange={(v) => onChange('tempo', v as TeamInstructions['tempo'])}
          options={[
            { value: 'slow', label: 'Yavaş' },
            { value: 'medium', label: 'Orta' },
            { value: 'fast', label: 'Hızlı' },
          ]}
        />
      </div>
      <div className="mt-3">
        <Field label="Talimat notu">
          <input
            type="text"
            value={instructions.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            maxLength={500}
            placeholder="örn. 'Sol kanatta çapraz koşular ön planda'"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>
      </div>
    </div>
  )
}

function ThresholdsSection({
  thresholds,
  onChange,
  onReset,
}: {
  thresholds: Thresholds
  onChange: <K extends keyof Thresholds>(key: K, value: number) => void
  onReset: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Sapma Eşikleri</h2>
          <p className="text-xs text-muted-foreground">
            Sahada gerçekleşen değer bu eşikleri aşarsa canlı uyarı çıkar.
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" aria-hidden /> Varsayılan
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="Kompaktlık üst eşiği (m)"
          hint="Bu değerin üstüne çıkılırsa 'Savunma açıldı' (RİSK)"
          value={thresholds.compactness_max_m}
          min={5}
          max={80}
          step={1}
          onChange={(v) => onChange('compactness_max_m', v)}
        />
        <NumberField
          label="Kompaktlık alt eşiği (m)"
          hint="Bu değerin altına inilirse 'Takım yığıldı' (DİKKAT)"
          value={thresholds.compactness_min_m}
          min={5}
          max={80}
          step={1}
          onChange={(v) => onChange('compactness_min_m', v)}
        />
        <NumberField
          label="Pres alt sınırı (kendi)"
          hint="Kendi pres skorumuz bu altındaysa 'Yetersiz baskı'"
          value={thresholds.pressure_min_self}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onChange('pressure_min_self', v)}
        />
        <NumberField
          label="Pres üst sınırı (rakip)"
          hint="Rakip pres skoru bu üstündeyse 'Baskı altındayız' (DİKKAT)"
          value={thresholds.pressure_max_opponent}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onChange('pressure_max_opponent', v)}
        />
        <NumberField
          label="Kanat yığılma oranı"
          hint="Bir kanada bu orandan fazla yığılma → diğer kanat boş (FIRSAT)"
          value={thresholds.wing_imbalance_max}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onChange('wing_imbalance_max', v)}
        />
        <NumberField
          label="Sahiplenme alt sınırı (kendi)"
          hint="Kendi sahiplenmemiz bu altındaysa dikkat çekilebilir"
          value={thresholds.possession_min_self}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => onChange('possession_min_self', v)}
        />
      </div>
    </div>
  )
}

// =============================================================================
// Yardımcılar
// =============================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

interface SelectOption<T extends string> {
  value: T
  label: string
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: SelectOption<T>[]
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right font-mono text-sm"
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state.kind === 'idle') {
    return (
      <span className="text-xs text-muted-foreground">
        Değişiklik yapıldıkça kaydet — uyarı motoru anında yeni eşiklerle çalışır.
      </span>
    )
  }
  if (state.kind === 'saving') {
    return <span className="text-xs text-muted-foreground">Kaydediliyor…</span>
  }
  if (state.kind === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <Check className="h-3 w-3" aria-hidden /> Kaydedildi
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs text-destructive',
      )}
    >
      <AlertCircle className="h-3 w-3" aria-hidden /> {state.message}
    </span>
  )
}
