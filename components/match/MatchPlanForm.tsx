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

// Tek oyuncu görevi — formasyon slot'una oyuncu + rol bağlar.
// Python tarafıyla aynı snake_case alan adları (Pydantic uyum).
export interface PlayerAssignment {
  position: string // "GK" | "DF" | "MF" | "FW" (jenerik kategori)
  role: string // serbest metin, örn. "ball_playing_defender"
  player_id: string | null
  instructions: string[]
}

// Kadrodan dropdown için minimum bilgi
export interface SquadOption {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number
  position: string
}

export interface PlanPayload {
  name: string
  formation: string
  teamInstructions: TeamInstructions
  thresholds: Thresholds
  playerAssignments: PlayerAssignment[]
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

/**
 * Diziliş satırından oyuncu slot'ları üretir.
 * "4-3-3" → 1 GK + 4 DF + 3 MF + 3 FW = 11 boş atama.
 *
 * Slot'lar her diziliş değişiminde yeniden üretilir; mevcut atamalar
 * pozisyon eşleştiğinde sırayla aktarılır (DF1, DF2 vb.).
 */
function generateSlots(formation: string): PlayerAssignment[] {
  const counts = formation.split('-').map(Number)
  if (counts.length < 2 || counts.some(isNaN)) return []
  const slots: PlayerAssignment[] = [
    { position: 'GK', role: '', player_id: null, instructions: [] },
  ]
  // İlk grup = defans
  for (let i = 0; i < counts[0]!; i++) {
    slots.push({ position: 'DF', role: '', player_id: null, instructions: [] })
  }
  // Aradakiler = orta saha (3-5-2 gibi tek orta grup veya 4-2-3-1 gibi iki orta grup)
  for (const g of counts.slice(1, -1)) {
    for (let i = 0; i < g; i++) {
      slots.push({ position: 'MF', role: '', player_id: null, instructions: [] })
    }
  }
  // Son grup = forvet
  for (let i = 0; i < counts[counts.length - 1]!; i++) {
    slots.push({ position: 'FW', role: '', player_id: null, instructions: [] })
  }
  return slots
}

/**
 * Eski atamaları yeni slot dizisine pozisyon-sırasıyla aktar.
 * (Formasyon değişince kayıp önler — DF1'den DF1'e, MF1→MF1 vb.)
 */
function mergeAssignments(
  oldAssignments: PlayerAssignment[],
  newSlots: PlayerAssignment[],
): PlayerAssignment[] {
  const byPos: Record<string, PlayerAssignment[]> = {}
  for (const a of oldAssignments) {
    if (!byPos[a.position]) byPos[a.position] = []
    byPos[a.position]!.push(a)
  }
  return newSlots.map((slot) => {
    const next = byPos[slot.position]?.shift()
    return next ?? slot
  })
}

const POSITION_LABELS: Record<string, string> = {
  GK: 'Kaleci',
  DF: 'Defans',
  MF: 'Orta Saha',
  FW: 'Forvet',
}

// =============================================================================
// Form
// =============================================================================

interface Props {
  matchId: string
  opponentName: string
  initial: PlanPayload | null
  /** Kadrodaki oyuncular — assignment dropdown'larında listelenir */
  availablePlayers: SquadOption[]
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

export function MatchPlanForm({ matchId, opponentName, initial, availablePlayers }: Props) {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanPayload>(() => {
    if (initial) {
      // Mevcut planı kullan; assignment yoksa formasyondan slot üret
      return {
        ...initial,
        playerAssignments:
          initial.playerAssignments.length > 0
            ? initial.playerAssignments
            : generateSlots(initial.formation),
      }
    }
    return {
      name: `${opponentName} maç planı`,
      formation: '4-3-3',
      teamInstructions: DEFAULT_TEAM_INSTRUCTIONS,
      thresholds: DEFAULT_THRESHOLDS,
      playerAssignments: generateSlots('4-3-3'),
      notes: '',
    }
  })
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

  // Diziliş değişimi → slot dizisini yeniden üret, mevcut atamaları aktar
  const setFormation = (formation: string) => {
    setPlan((p) => {
      const newSlots = generateSlots(formation)
      return {
        ...p,
        formation,
        playerAssignments: mergeAssignments(p.playerAssignments, newSlots),
      }
    })
    setSaveState({ kind: 'idle' })
  }

  const updateAssignment = (idx: number, patch: Partial<PlayerAssignment>) => {
    setPlan((p) => ({
      ...p,
      playerAssignments: p.playerAssignments.map((a, i) =>
        i === idx ? { ...a, ...patch } : a,
      ),
    }))
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
      <PlanIdentity
        plan={plan}
        onChange={(p) => { setPlan(p); setSaveState({ kind: 'idle' }) }}
        onFormationChange={setFormation}
      />
      <TeamInstructionsSection instructions={plan.teamInstructions} onChange={setInstr} />
      <PlayerAssignmentsSection
        assignments={plan.playerAssignments}
        availablePlayers={availablePlayers}
        onUpdate={updateAssignment}
      />
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
  onFormationChange,
}: {
  plan: PlanPayload
  onChange: (p: PlanPayload) => void
  onFormationChange: (f: string) => void
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
            onChange={(e) => onFormationChange(e.target.value)}
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

function PlayerAssignmentsSection({
  assignments,
  availablePlayers,
  onUpdate,
}: {
  assignments: PlayerAssignment[]
  availablePlayers: SquadOption[]
  onUpdate: (idx: number, patch: Partial<PlayerAssignment>) => void
}) {
  // Aynı oyuncuyu birden fazla slot'a koymayı engellemek için seçili ID seti
  const usedPlayerIds = new Set(
    assignments.map((a) => a.player_id).filter(Boolean) as string[],
  )

  // Pozisyona göre slot sayacı (UI etiketleri için: "Defans 1", "Defans 2" vb.)
  const posCounter: Record<string, number> = {}

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold">Oyuncu Görevleri</h2>
          <p className="text-xs text-muted-foreground">
            Dizilişin her slot'una kadrodan oyuncu ata + ona özel taktik rol/talimat ver.
          </p>
        </div>
        {availablePlayers.length === 0 && (
          <a
            href="/squad"
            className="text-xs text-primary hover:underline"
          >
            Kadro boş — ekle →
          </a>
        )}
      </div>

      <div className="space-y-2">
        {assignments.map((a, idx) => {
          posCounter[a.position] = (posCounter[a.position] ?? 0) + 1
          const label =
            a.position === 'GK'
              ? 'Kaleci'
              : `${POSITION_LABELS[a.position] ?? a.position} ${posCounter[a.position]}`
          return (
            <PlayerAssignmentRow
              key={idx}
              label={label}
              assignment={a}
              availablePlayers={availablePlayers}
              usedPlayerIds={usedPlayerIds}
              onUpdate={(patch) => onUpdate(idx, patch)}
            />
          )
        })}
      </div>
    </div>
  )
}

function PlayerAssignmentRow({
  label,
  assignment,
  availablePlayers,
  usedPlayerIds,
  onUpdate,
}: {
  label: string
  assignment: PlayerAssignment
  availablePlayers: SquadOption[]
  usedPlayerIds: Set<string>
  onUpdate: (patch: Partial<PlayerAssignment>) => void
}) {
  // Bu satırın kendisi seçilmiş — listeden çıkarmamak için
  const own = assignment.player_id
  const selectable = availablePlayers.filter(
    (p) => p.id === own || !usedPlayerIds.has(p.id),
  )

  return (
    <div className="grid items-center gap-2 rounded-md border border-border bg-background/40 p-2 sm:grid-cols-[120px_1fr_1fr]">
      <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={assignment.player_id ?? ''}
        onChange={(e) => onUpdate({ player_id: e.target.value || null })}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        aria-label={`${label} oyuncu`}
      >
        <option value="">— Oyuncu seç —</option>
        {selectable.map((p) => (
          <option key={p.id} value={p.id}>
            #{p.jerseyNumber} {p.firstName} {p.lastName} ({p.position})
          </option>
        ))}
      </select>
      <input
        type="text"
        value={assignment.role}
        onChange={(e) => onUpdate({ role: e.target.value })}
        placeholder="Rol/talimat (örn. 'box-to-box', 'sol ayağıyla orta açar')"
        maxLength={80}
        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        aria-label={`${label} rol`}
      />
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
