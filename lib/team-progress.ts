/**
 * Takımın çoklu-maç ilerleme verisi.
 *
 * Tek maçın frame-bazlı `Analysis` satırlarını maç-bazına indirir; sonra son N
 * maçı kronolojik sırada (eski → yeni) listeler. Çıktı hem `ProgressTimeline`
 * grafiğini hem de Claude gelişim raporu prompt'unu besleyecek tek kaynak.
 */
import { prisma } from '@/lib/db/client'
import type { BallStats } from '@/types/video-analysis'

const ZONE_KEYS = [
  'top_left', 'top_center', 'top_right',
  'mid_left', 'mid_center', 'mid_right',
  'bot_left', 'bot_center', 'bot_right',
] as const

export type ZoneKey = (typeof ZONE_KEYS)[number]

export interface MatchProgress {
  matchId: string
  date: Date
  opponentName: string
  homeScore: number | null
  awayScore: number | null
  formation: string | null
  framesAnalyzed: number
  avgCompactnessA: number
  avgCompactnessB: number
  avgPressureScore: number
  // ballStats varsa 0-1 oranı; yoksa null
  possessionA: number | null
  possessionB: number | null
  zonesATotals: Record<ZoneKey, number>
}

export interface TeamProgress {
  teamId: string
  teamName: string
  matches: MatchProgress[]
}

/**
 * Bir takımın son `limit` adet analiz tamamlanmış maçını döner (eski → yeni).
 * Sadece en az 1 anlamlı `Analysis` satırı olan maçlar dahil edilir.
 *
 * Takım yoksa `null`, takım var ama analizli maç yoksa `matches: []` döner.
 */
export async function getTeamProgress(
  teamId: string,
  limit = 5,
): Promise<TeamProgress | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  })
  if (!team) return null

  const matches = await prisma.match.findMany({
    where: {
      homeTeamId: teamId,
      analyses: { some: {} },
    },
    orderBy: { date: 'desc' },
    take: limit,
    include: {
      analyses: {
        select: {
          compactnessA: true,
          compactnessB: true,
          pressureScore: true,
          zonesA: true,
        },
      },
      videos: {
        where: { status: 'done' },
        orderBy: { createdAt: 'desc' },
        select: { ballStats: true },
        take: 1,
      },
    },
  })

  const progressMatches: MatchProgress[] = matches.map((m) => {
    const n = m.analyses.length
    const denom = Math.max(1, n)

    let sumCompA = 0
    let sumCompB = 0
    let sumPressure = 0
    const zonesATotals: Record<ZoneKey, number> = Object.fromEntries(
      ZONE_KEYS.map((k) => [k, 0]),
    ) as Record<ZoneKey, number>

    for (const a of m.analyses) {
      sumCompA += a.compactnessA
      sumCompB += a.compactnessB
      sumPressure += a.pressureScore
      const z = a.zonesA as Record<string, number> | null
      if (z) {
        for (const k of ZONE_KEYS) zonesATotals[k] += z[k] ?? 0
      }
    }

    const ballStats = (m.videos[0]?.ballStats ?? null) as BallStats | null

    return {
      matchId: m.id,
      date: m.date,
      opponentName: m.awayTeamName,
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      formation: m.formation,
      framesAnalyzed: n,
      avgCompactnessA: sumCompA / denom,
      avgCompactnessB: sumCompB / denom,
      avgPressureScore: sumPressure / denom,
      possessionA: ballStats?.possession?.a ?? null,
      possessionB: ballStats?.possession?.b ?? null,
      zonesATotals,
    }
  })

  // Grafikte kronolojik (sol = eski, sağ = en yeni) görünmesi için ters çevir
  return {
    teamId: team.id,
    teamName: team.name,
    matches: progressMatches.reverse(),
  }
}
