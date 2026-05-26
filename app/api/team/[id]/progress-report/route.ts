import { NextResponse } from 'next/server'
import { z } from 'zod'
import { askClaude } from '@/lib/ai/claude'
import {
  TEAM_PROGRESS_SYSTEM_PROMPT,
  buildTeamProgressUserPrompt,
} from '@/lib/ai/team-progress-prompt'
import { getTeamProgress } from '@/lib/team-progress'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(2).max(20).default(5),
})

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY tanımlı değil. .env.local dosyasını kontrol edin.' },
        { status: 503 },
      )
    }

    const url = new URL(req.url)
    const { limit } = QuerySchema.parse({
      limit: url.searchParams.get('limit'),
    })

    const progress = await getTeamProgress(params.id, limit)
    if (progress === null) {
      return NextResponse.json({ error: 'Takım bulunamadı' }, { status: 404 })
    }

    if (progress.matches.length < 2) {
      return NextResponse.json(
        {
          error: 'Trend için en az 2 analiz edilmiş maç gerekli',
          matchCount: progress.matches.length,
        },
        { status: 422 },
      )
    }

    const userPrompt = buildTeamProgressUserPrompt(
      progress.teamName,
      progress.matches,
    )

    const { text, usage } = await askClaude({
      systemPrompt: TEAM_PROGRESS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 400,
    })

    return NextResponse.json({
      report: text,
      usage,
      matchCount: progress.matches.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz istek', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Gelişim raporu hatası:', error)
    const message = error instanceof Error ? error.message : 'Sunucu hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
