/**
 * Kadro veri katmanı — DB Player'ı UI'nın beklediği MockPlayer formatına çevirir.
 *
 * UI tarafı (SquadFilters, PlayerCard, PlayerRadar) MockPlayer interface'ine
 * göre yazılmış; form/fatigue/attributes gibi alanlar şu an DB'de doğrudan
 * yok. Burada DB Player'ı UI-uyumlu hale getiriyoruz; eksik alanlar
 * pozisyona göre default değerlerle dolduruluyor.
 *
 * Gelecekte:
 *  - form  → son N PlayerStat ortalamasından hesap
 *  - fatigue → son FitnessLog kaydından
 *  - isInjured → aktif Injury (actualReturn null) varsa true
 *  - attributes → PlayerStat agregat + scout notlarından
 */
import { prisma } from '@/lib/db/client'
import type { MockPlayer, PlayerPosition } from '@/lib/data/mock-players'

/**
 * Tek bir oyuncuyu UI-formatında döner; yoksa null.
 * /squad/[id] sayfası bunu çağırır.
 */
export async function getPlayerById(playerId: string): Promise<MockPlayer | null> {
  const p = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      injuries: { where: { actualReturn: null }, select: { id: true }, take: 1 },
      fitnessLogs: { orderBy: { date: 'desc' }, take: 1, select: { fatigue: true } },
    },
  })
  if (!p) return null
  return toMockPlayer(p)
}

/**
 * Tek bir takımın kadrosunu UI-formatında döner.
 * teamId verilmezse ilk takımı kullanır (tek-takım MVP).
 */
export async function getSquadPlayers(teamId?: string): Promise<MockPlayer[]> {
  let effectiveTeamId = teamId
  if (!effectiveTeamId) {
    const t = await prisma.team.findFirst({ select: { id: true } })
    if (!t) return []
    effectiveTeamId = t.id
  }

  const dbPlayers = await prisma.player.findMany({
    where: { teamId: effectiveTeamId },
    orderBy: [{ position: 'asc' }, { jerseyNumber: 'asc' }],
    include: {
      injuries: {
        where: { actualReturn: null },
        select: { id: true },
        take: 1,
      },
      fitnessLogs: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { fatigue: true },
      },
    },
  })

  return dbPlayers.map(toMockPlayer)
}

type DbPlayer = Awaited<ReturnType<typeof prisma.player.findMany>>[number] & {
  injuries: { id: string }[]
  fitnessLogs: { fatigue: number }[]
}

function toMockPlayer(p: DbPlayer): MockPlayer {
  const pos = normalizePosition(p.position)
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    jerseyNumber: p.jerseyNumber,
    position: pos,
    birthDate: p.birthDate.toISOString().slice(0, 10),
    nationality: p.nationality ?? 'TUR',
    height: p.height ?? 180,
    weight: p.weight ?? 75,
    preferredFoot: (p.preferredFoot as MockPlayer['preferredFoot']) ?? 'right',
    marketValue: p.marketValue ?? 0,
    // Placeholder — PlayerStat / FitnessLog'tan türetilene kadar
    form: 70,
    fatigue: p.fitnessLogs[0]?.fatigue ?? 30,
    isInjured: p.injuries.length > 0,
    attributes: defaultAttributesForPosition(pos),
  }
}

function normalizePosition(raw: string): PlayerPosition {
  const upper = raw.toUpperCase()
  if (upper === 'GK' || upper === 'DF' || upper === 'MF' || upper === 'FW') {
    return upper
  }
  return 'MF' // fallback
}

/**
 * Pozisyona göre makul varsayılan yetenek skorları (0-100).
 * Gerçek değerler PlayerStat + scout raporlarından gelecek; şimdilik
 * radar grafiğinin boş kalmaması için placeholder.
 */
function defaultAttributesForPosition(pos: PlayerPosition): MockPlayer['attributes'] {
  switch (pos) {
    case 'GK':
      return { pace: 60, shooting: 30, passing: 60, dribbling: 50, defending: 80, physical: 75 }
    case 'DF':
      return { pace: 70, shooting: 40, passing: 65, dribbling: 55, defending: 85, physical: 80 }
    case 'MF':
      return { pace: 75, shooting: 65, passing: 80, dribbling: 75, defending: 65, physical: 75 }
    case 'FW':
      return { pace: 85, shooting: 85, passing: 70, dribbling: 80, defending: 50, physical: 70 }
  }
}
