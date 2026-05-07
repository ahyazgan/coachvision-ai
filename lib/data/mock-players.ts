/**
 * Geliştirme için sahte oyuncu verisi.
 * DB bağlandığında prisma.player.findMany() ile değiştirilir.
 */

export type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW'

export interface MockPlayer {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number
  position: PlayerPosition
  birthDate: string
  nationality: string
  height: number
  weight: number
  preferredFoot: 'left' | 'right' | 'both'
  marketValue: number
  /** Form skoru 0-100 */
  form: number
  /** Yorgunluk 0-100 (yüksek = daha yorgun) */
  fatigue: number
  isInjured: boolean
  /** Radar grafik için 6 yetenek skoru 0-100 */
  attributes: {
    pace: number
    shooting: number
    passing: number
    dribbling: number
    defending: number
    physical: number
  }
}

export const MOCK_PLAYERS: MockPlayer[] = [
  // Kaleciler
  {
    id: 'p1',
    firstName: 'Uğurcan',
    lastName: 'Çakır',
    jerseyNumber: 1,
    position: 'GK',
    birthDate: '1996-04-05',
    nationality: 'TR',
    height: 191,
    weight: 84,
    preferredFoot: 'right',
    marketValue: 18000000,
    form: 82,
    fatigue: 35,
    isInjured: false,
    attributes: { pace: 55, shooting: 30, passing: 70, dribbling: 50, defending: 88, physical: 86 },
  },
  {
    id: 'p2',
    firstName: 'Mert',
    lastName: 'Günok',
    jerseyNumber: 12,
    position: 'GK',
    birthDate: '1989-03-01',
    nationality: 'TR',
    height: 192,
    weight: 87,
    preferredFoot: 'right',
    marketValue: 4500000,
    form: 75,
    fatigue: 20,
    isInjured: false,
    attributes: { pace: 50, shooting: 28, passing: 68, dribbling: 45, defending: 84, physical: 84 },
  },
  // Defans
  {
    id: 'p3',
    firstName: 'Merih',
    lastName: 'Demiral',
    jerseyNumber: 4,
    position: 'DF',
    birthDate: '1998-03-05',
    nationality: 'TR',
    height: 192,
    weight: 88,
    preferredFoot: 'right',
    marketValue: 25000000,
    form: 78,
    fatigue: 55,
    isInjured: false,
    attributes: { pace: 70, shooting: 50, passing: 72, dribbling: 60, defending: 86, physical: 88 },
  },
  {
    id: 'p4',
    firstName: 'Çağlar',
    lastName: 'Söyüncü',
    jerseyNumber: 5,
    position: 'DF',
    birthDate: '1996-05-23',
    nationality: 'TR',
    height: 187,
    weight: 81,
    preferredFoot: 'right',
    marketValue: 12000000,
    form: 71,
    fatigue: 60,
    isInjured: false,
    attributes: { pace: 72, shooting: 45, passing: 70, dribbling: 62, defending: 82, physical: 84 },
  },
  {
    id: 'p5',
    firstName: 'Zeki',
    lastName: 'Çelik',
    jerseyNumber: 2,
    position: 'DF',
    birthDate: '1997-02-17',
    nationality: 'TR',
    height: 180,
    weight: 75,
    preferredFoot: 'right',
    marketValue: 8000000,
    form: 74,
    fatigue: 48,
    isInjured: false,
    attributes: { pace: 80, shooting: 55, passing: 74, dribbling: 70, defending: 76, physical: 78 },
  },
  {
    id: 'p6',
    firstName: 'Ferdi',
    lastName: 'Kadıoğlu',
    jerseyNumber: 3,
    position: 'DF',
    birthDate: '1999-10-07',
    nationality: 'TR',
    height: 178,
    weight: 73,
    preferredFoot: 'left',
    marketValue: 22000000,
    form: 80,
    fatigue: 62,
    isInjured: false,
    attributes: { pace: 84, shooting: 60, passing: 78, dribbling: 76, defending: 74, physical: 78 },
  },
  {
    id: 'p7',
    firstName: 'Abdülkerim',
    lastName: 'Bardakcı',
    jerseyNumber: 13,
    position: 'DF',
    birthDate: '1994-09-07',
    nationality: 'TR',
    height: 188,
    weight: 82,
    preferredFoot: 'left',
    marketValue: 6500000,
    form: 76,
    fatigue: 40,
    isInjured: true,
    attributes: { pace: 64, shooting: 42, passing: 70, dribbling: 56, defending: 84, physical: 82 },
  },
  {
    id: 'p8',
    firstName: 'Samet',
    lastName: 'Akaydin',
    jerseyNumber: 24,
    position: 'DF',
    birthDate: '1994-03-13',
    nationality: 'TR',
    height: 188,
    weight: 84,
    preferredFoot: 'right',
    marketValue: 4000000,
    form: 70,
    fatigue: 30,
    isInjured: false,
    attributes: { pace: 60, shooting: 40, passing: 66, dribbling: 50, defending: 80, physical: 84 },
  },
  // Orta Saha
  {
    id: 'p9',
    firstName: 'Hakan',
    lastName: 'Çalhanoğlu',
    jerseyNumber: 10,
    position: 'MF',
    birthDate: '1994-02-08',
    nationality: 'TR',
    height: 178,
    weight: 76,
    preferredFoot: 'left',
    marketValue: 35000000,
    form: 88,
    fatigue: 70,
    isInjured: false,
    attributes: { pace: 70, shooting: 86, passing: 90, dribbling: 82, defending: 70, physical: 76 },
  },
  {
    id: 'p10',
    firstName: 'Arda',
    lastName: 'Güler',
    jerseyNumber: 8,
    position: 'MF',
    birthDate: '2005-02-25',
    nationality: 'TR',
    height: 175,
    weight: 70,
    preferredFoot: 'left',
    marketValue: 30000000,
    form: 84,
    fatigue: 45,
    isInjured: false,
    attributes: { pace: 76, shooting: 82, passing: 86, dribbling: 88, defending: 50, physical: 64 },
  },
  {
    id: 'p11',
    firstName: 'Orkun',
    lastName: 'Kökçü',
    jerseyNumber: 6,
    position: 'MF',
    birthDate: '2000-12-29',
    nationality: 'TR',
    height: 177,
    weight: 75,
    preferredFoot: 'right',
    marketValue: 18000000,
    form: 78,
    fatigue: 52,
    isInjured: false,
    attributes: { pace: 72, shooting: 76, passing: 82, dribbling: 78, defending: 68, physical: 76 },
  },
  {
    id: 'p12',
    firstName: 'Salih',
    lastName: 'Özcan',
    jerseyNumber: 14,
    position: 'MF',
    birthDate: '1998-01-11',
    nationality: 'TR',
    height: 184,
    weight: 78,
    preferredFoot: 'right',
    marketValue: 7000000,
    form: 72,
    fatigue: 58,
    isInjured: false,
    attributes: { pace: 66, shooting: 64, passing: 76, dribbling: 70, defending: 78, physical: 80 },
  },
  {
    id: 'p13',
    firstName: 'İsmail',
    lastName: 'Yüksek',
    jerseyNumber: 23,
    position: 'MF',
    birthDate: '1999-04-18',
    nationality: 'TR',
    height: 182,
    weight: 76,
    preferredFoot: 'right',
    marketValue: 5500000,
    form: 70,
    fatigue: 40,
    isInjured: false,
    attributes: { pace: 70, shooting: 60, passing: 72, dribbling: 68, defending: 76, physical: 78 },
  },
  {
    id: 'p14',
    firstName: 'Yunus',
    lastName: 'Akgün',
    jerseyNumber: 17,
    position: 'MF',
    birthDate: '2000-07-07',
    nationality: 'TR',
    height: 174,
    weight: 70,
    preferredFoot: 'right',
    marketValue: 9000000,
    form: 80,
    fatigue: 65,
    isInjured: false,
    attributes: { pace: 84, shooting: 74, passing: 76, dribbling: 84, defending: 50, physical: 70 },
  },
  {
    id: 'p15',
    firstName: 'Kerem',
    lastName: 'Aktürkoğlu',
    jerseyNumber: 7,
    position: 'MF',
    birthDate: '1998-10-21',
    nationality: 'TR',
    height: 180,
    weight: 75,
    preferredFoot: 'right',
    marketValue: 16000000,
    form: 82,
    fatigue: 60,
    isInjured: false,
    attributes: { pace: 86, shooting: 80, passing: 76, dribbling: 84, defending: 52, physical: 70 },
  },
  // Forvet
  {
    id: 'p16',
    firstName: 'Cenk',
    lastName: 'Tosun',
    jerseyNumber: 9,
    position: 'FW',
    birthDate: '1991-06-07',
    nationality: 'TR',
    height: 184,
    weight: 79,
    preferredFoot: 'right',
    marketValue: 2500000,
    form: 68,
    fatigue: 30,
    isInjured: false,
    attributes: { pace: 64, shooting: 80, passing: 70, dribbling: 70, defending: 36, physical: 80 },
  },
  {
    id: 'p17',
    firstName: 'Barış Alper',
    lastName: 'Yılmaz',
    jerseyNumber: 22,
    position: 'FW',
    birthDate: '2000-05-23',
    nationality: 'TR',
    height: 187,
    weight: 79,
    preferredFoot: 'right',
    marketValue: 14000000,
    form: 84,
    fatigue: 55,
    isInjured: false,
    attributes: { pace: 88, shooting: 76, passing: 70, dribbling: 78, defending: 48, physical: 82 },
  },
  {
    id: 'p18',
    firstName: 'İrfan Can',
    lastName: 'Kahveci',
    jerseyNumber: 11,
    position: 'FW',
    birthDate: '1995-07-15',
    nationality: 'TR',
    height: 178,
    weight: 75,
    preferredFoot: 'right',
    marketValue: 8000000,
    form: 72,
    fatigue: 42,
    isInjured: false,
    attributes: { pace: 76, shooting: 80, passing: 78, dribbling: 80, defending: 50, physical: 72 },
  },
  {
    id: 'p19',
    firstName: 'Semih',
    lastName: 'Kılıçsoy',
    jerseyNumber: 19,
    position: 'FW',
    birthDate: '2005-08-22',
    nationality: 'TR',
    height: 178,
    weight: 72,
    preferredFoot: 'right',
    marketValue: 12000000,
    form: 80,
    fatigue: 48,
    isInjured: false,
    attributes: { pace: 82, shooting: 78, passing: 70, dribbling: 80, defending: 40, physical: 70 },
  },
  {
    id: 'p20',
    firstName: 'Enes',
    lastName: 'Ünal',
    jerseyNumber: 20,
    position: 'FW',
    birthDate: '1997-05-10',
    nationality: 'TR',
    height: 188,
    weight: 84,
    preferredFoot: 'right',
    marketValue: 9000000,
    form: 70,
    fatigue: 25,
    isInjured: true,
    attributes: { pace: 72, shooting: 80, passing: 70, dribbling: 72, defending: 40, physical: 82 },
  },
]

export function findMockPlayerById(id: string): MockPlayer | undefined {
  return MOCK_PLAYERS.find((p) => p.id === id)
}

export function calculateAge(birthDateISO: string): number {
  const birth = new Date(birthDateISO)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

export function formatMarketValue(value: number): string {
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
  return `€${value}`
}
