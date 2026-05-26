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
  type PlanContext,
} from '@/lib/ai/match-uyum-prompt'
import { prisma } from '@/lib/db/client'
import { complianceToPromptText, computeCompliance } from '@/lib/match-compliance'

/** Prisma'daki MatchPlan'dan Claude prompt context'ini çıkarır. */
function extractPlanContext(plan: {
  formation: string
  teamInstructions: unknown
  notes: string | null
}): PlanContext | null {
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
  return {
    formation: plan.formation,
    defensiveLine: t.defensive_line,
    pressing: t.pressing,
    possessionStyle: t.possession_style,
    width: t.width,
    tempo: t.tempo,
    notes: plan.notes ?? undefined,
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
        const planContext = match.plan ? extractPlanContext(match.plan) : null
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
