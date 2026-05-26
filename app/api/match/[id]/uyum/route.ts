/**
 * Maç sonu plan-uyum raporu üretimi.
 *
 * GET → MatchEvent'leri okuyup `computeCompliance` ile istatistik çıkarır,
 *       Claude'a özet ürettirir, JSON döner (UI sayfası tüketir).
 *
 * Önbellekleme yok — her çağrı yeni Claude isteği. Hot path olursa
 * `MatchReport` tablosu eklenir; şimdilik düşük yük varsayımı.
 */
import { NextResponse } from 'next/server'
import { askClaude } from '@/lib/ai/claude'
import {
  MATCH_UYUM_SYSTEM_PROMPT,
  buildMatchUyumUserPrompt,
  type PlanAssignmentSummary,
  type PlanContext,
} from '@/lib/ai/match-uyum-prompt'
import { prisma } from '@/lib/db/client'
import { complianceToPromptText, computeCompliance } from '@/lib/match-compliance'

interface PlanRow {
  formation: string
  teamInstructions: unknown
  playerAssignments: unknown
  notes: string | null
}

interface PlayerRow {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number
}

/** Prisma'daki MatchPlan'dan Claude prompt context'ini çıkarır.
 *
 * `playerLookup`: plan'a atanan player_id'lerin (varsa) DB'den çekilmiş
 * isim+forma bilgisi. Claude prompt'unda "Hakan #10 (MF): box-to-box" gibi
 * okunabilir satıra dönüşür.
 */
function extractPlanContext(
  plan: PlanRow,
  playerLookup: Map<string, PlayerRow>,
): PlanContext | null {
  const ti = plan.teamInstructions
  if (typeof ti !== 'object' || ti === null) return null
  const t = ti as Record<string, unknown>
  if (
    typeof t.defensive_line !== 'string' ||
    typeof t.pressing !== 'string' ||
    typeof t.possession_style !== 'string' ||
    typeof t.width !== 'string' ||
    typeof t.tempo !== 'string'
  ) {
    return null
  }

  // Doldurulmuş atamaları (oyuncu + rol her ikisi de var) Claude'a geçir
  const assignments: PlanAssignmentSummary[] = []
  if (Array.isArray(plan.playerAssignments)) {
    for (const raw of plan.playerAssignments) {
      if (typeof raw !== 'object' || raw === null) continue
      const a = raw as Record<string, unknown>
      const playerId = typeof a.player_id === 'string' ? a.player_id : null
      const role = typeof a.role === 'string' ? a.role.trim() : ''
      const position = typeof a.position === 'string' ? a.position : ''
      // Hem oyuncu hem rol boşsa atla; en az biri varsa Claude'a faydalı
      if (!playerId && !role) continue
      const player = playerId ? playerLookup.get(playerId) : null
      const label = player
        ? `#${player.jerseyNumber} ${player.firstName} ${player.lastName}`
        : '— oyuncu atanmadı —'
      assignments.push({
        position: position || '—',
        role: role || '(rol belirtilmedi)',
        playerLabel: label,
      })
    }
  }

  return {
    formation: plan.formation,
    defensiveLine: t.defensive_line,
    pressing: t.pressing,
    possessionStyle: t.possession_style,
    width: t.width,
    tempo: t.tempo,
    notes: plan.notes ?? undefined,
    assignments: assignments.length > 0 ? assignments : undefined,
  }
}

interface RouteContext {
  params: { id: string }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: {
        plan: {
          select: {
            name: true,
            formation: true,
            teamInstructions: true,
            playerAssignments: true,
            notes: true,
          },
        },
        events: {
          select: { type: true, minute: true, details: true },
          orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })
    if (!match) {
      return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })
    }

    // İşlenen dakika tahmini: en yüksek event dakikası (yoksa 0)
    const maxMin = match.events.reduce((m, e) => Math.max(m, e.minute), 0)
    const compliance = computeCompliance(match.events, Math.max(1, maxMin))

    const planName = match.plan?.name ?? 'Varsayılan plan'

    let aiReport: string | null = null
    let aiUsage: { input_tokens: number; output_tokens: number } | null = null
    let aiError: string | null = null

    if (!process.env.ANTHROPIC_API_KEY) {
      aiError = 'ANTHROPIC_API_KEY tanımlı değil — Claude yorumu atlandı'
    } else if (compliance.totalCommands === 0 && compliance.liveEventCount === 0) {
      aiError = 'Henüz veri yok — canlı oturum tamamlanmamış olabilir'
    } else {
      try {
        // Plan'da atanmış oyuncu ID'lerini topla → DB'den isim/forma çek
        const playerLookup = new Map<string, PlayerRow>()
        if (match.plan && Array.isArray(match.plan.playerAssignments)) {
          const ids: string[] = []
          for (const raw of match.plan.playerAssignments) {
            if (
              typeof raw === 'object' &&
              raw !== null &&
              typeof (raw as Record<string, unknown>).player_id === 'string'
            ) {
              ids.push((raw as Record<string, unknown>).player_id as string)
            }
          }
          if (ids.length > 0) {
            const players = await prisma.player.findMany({
              where: { id: { in: ids } },
              select: { id: true, firstName: true, lastName: true, jerseyNumber: true },
            })
            for (const p of players) playerLookup.set(p.id, p)
          }
        }

        const planContext = match.plan
          ? extractPlanContext(match.plan, playerLookup)
          : null
        const userPrompt = buildMatchUyumUserPrompt(
          complianceToPromptText(compliance, planName),
          planContext ?? undefined,
        )
        const { text, usage } = await askClaude({
          systemPrompt: MATCH_UYUM_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
          maxTokens: 400,
        })
        aiReport = text
        aiUsage = { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens }
      } catch (e) {
        aiError = e instanceof Error ? e.message : 'Claude isteği başarısız'
      }
    }

    return NextResponse.json({
      matchId: match.id,
      opponentName: match.awayTeamName,
      planName,
      status: match.status,
      compliance,
      aiReport,
      aiUsage,
      aiError,
    })
  } catch (error) {
    console.error('Uyum raporu hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
