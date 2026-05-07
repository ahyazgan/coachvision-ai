/**
 * Formasyon presetleri.
 * Koordinatlar 0-100 ölçeğinde (saha dikey, kendi kalemiz altta).
 * y=95 → kendi kale, y=10 → rakip kale.
 */

export type FormationId = '4-3-3' | '4-4-2' | '3-5-2' | '4-2-3-1' | '5-3-2'

export interface FormationSlot {
  /** Pozisyon kısa kodu (UI'da etiket olarak gözükür). */
  role: string
  /** Pozisyon kategorisi - renklendirme için. */
  group: 'GK' | 'DF' | 'MF' | 'FW'
  x: number
  y: number
}

export interface Formation {
  id: FormationId
  label: string
  slots: FormationSlot[]
}

export const FORMATIONS: Record<FormationId, Formation> = {
  '4-3-3': {
    id: '4-3-3',
    label: '4-3-3 (Hücumcu)',
    slots: [
      { role: 'KL', group: 'GK', x: 50, y: 92 },
      { role: 'SB', group: 'DF', x: 15, y: 75 },
      { role: 'STP', group: 'DF', x: 37, y: 78 },
      { role: 'STP', group: 'DF', x: 63, y: 78 },
      { role: 'SB', group: 'DF', x: 85, y: 75 },
      { role: 'OOS', group: 'MF', x: 50, y: 58 },
      { role: 'OS', group: 'MF', x: 28, y: 48 },
      { role: 'OS', group: 'MF', x: 72, y: 48 },
      { role: 'KO', group: 'FW', x: 18, y: 25 },
      { role: 'SF', group: 'FW', x: 50, y: 18 },
      { role: 'KO', group: 'FW', x: 82, y: 25 },
    ],
  },
  '4-4-2': {
    id: '4-4-2',
    label: '4-4-2 (Klasik)',
    slots: [
      { role: 'KL', group: 'GK', x: 50, y: 92 },
      { role: 'SB', group: 'DF', x: 15, y: 75 },
      { role: 'STP', group: 'DF', x: 37, y: 78 },
      { role: 'STP', group: 'DF', x: 63, y: 78 },
      { role: 'SB', group: 'DF', x: 85, y: 75 },
      { role: 'KO', group: 'MF', x: 15, y: 50 },
      { role: 'OS', group: 'MF', x: 37, y: 53 },
      { role: 'OS', group: 'MF', x: 63, y: 53 },
      { role: 'KO', group: 'MF', x: 85, y: 50 },
      { role: 'SF', group: 'FW', x: 35, y: 22 },
      { role: 'SF', group: 'FW', x: 65, y: 22 },
    ],
  },
  '3-5-2': {
    id: '3-5-2',
    label: '3-5-2 (Yoğun Orta)',
    slots: [
      { role: 'KL', group: 'GK', x: 50, y: 92 },
      { role: 'STP', group: 'DF', x: 25, y: 78 },
      { role: 'LBR', group: 'DF', x: 50, y: 80 },
      { role: 'STP', group: 'DF', x: 75, y: 78 },
      { role: 'KAB', group: 'MF', x: 10, y: 55 },
      { role: 'OS', group: 'MF', x: 32, y: 52 },
      { role: 'OOS', group: 'MF', x: 50, y: 58 },
      { role: 'OS', group: 'MF', x: 68, y: 52 },
      { role: 'KAB', group: 'MF', x: 90, y: 55 },
      { role: 'SF', group: 'FW', x: 40, y: 22 },
      { role: 'SF', group: 'FW', x: 60, y: 22 },
    ],
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    label: '4-2-3-1 (Modern)',
    slots: [
      { role: 'KL', group: 'GK', x: 50, y: 92 },
      { role: 'SB', group: 'DF', x: 15, y: 75 },
      { role: 'STP', group: 'DF', x: 37, y: 78 },
      { role: 'STP', group: 'DF', x: 63, y: 78 },
      { role: 'SB', group: 'DF', x: 85, y: 75 },
      { role: 'OOS', group: 'MF', x: 38, y: 60 },
      { role: 'OOS', group: 'MF', x: 62, y: 60 },
      { role: 'KO', group: 'MF', x: 18, y: 38 },
      { role: 'OFS', group: 'MF', x: 50, y: 35 },
      { role: 'KO', group: 'MF', x: 82, y: 38 },
      { role: 'SF', group: 'FW', x: 50, y: 15 },
    ],
  },
  '5-3-2': {
    id: '5-3-2',
    label: '5-3-2 (Defansif)',
    slots: [
      { role: 'KL', group: 'GK', x: 50, y: 92 },
      { role: 'KKB', group: 'DF', x: 10, y: 72 },
      { role: 'STP', group: 'DF', x: 30, y: 80 },
      { role: 'LBR', group: 'DF', x: 50, y: 82 },
      { role: 'STP', group: 'DF', x: 70, y: 80 },
      { role: 'KKB', group: 'DF', x: 90, y: 72 },
      { role: 'OS', group: 'MF', x: 28, y: 52 },
      { role: 'OOS', group: 'MF', x: 50, y: 55 },
      { role: 'OS', group: 'MF', x: 72, y: 52 },
      { role: 'SF', group: 'FW', x: 38, y: 22 },
      { role: 'SF', group: 'FW', x: 62, y: 22 },
    ],
  },
}

export const FORMATION_LIST = Object.values(FORMATIONS)
