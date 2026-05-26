import { NextResponse } from 'next/server'
import { z } from 'zod'
import { askClaude } from '@/lib/ai/claude'
import { buildMatchContext, COACH_BASE_PROMPT, type MatchContext } from '@/lib/ai/prompts'
import { requireSession } from '@/lib/auth/require'

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(2000),
})

const MatchContextSchema = z.object({
  homeTeam: z.string(),
  awayTeam: z.string(),
  homeScore: z.number().int(),
  awayScore: z.number().int(),
  minute: z.number().int(),
  formation: z.string(),
  fatiguedPlayerNames: z.array(z.string()).optional(),
})

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
  context: MatchContextSchema.optional(),
})

export async function POST(req: Request) {
  try {
    const guard = await requireSession()
    if (guard instanceof NextResponse) return guard
    const body = await req.json()
    const { messages, context } = RequestSchema.parse(body)

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY tanımlı değil. .env.local dosyasını kontrol edin.' },
        { status: 503 },
      )
    }

    const systemPrompt = context
      ? buildMatchContext(context as MatchContext)
      : COACH_BASE_PROMPT

    // CLAUDE.md: konuşma geçmişini son 10 mesajla sınırla
    const recentMessages = messages.slice(-10)

    const { text, usage } = await askClaude({
      systemPrompt,
      messages: recentMessages,
      maxTokens: 512,
    })

    return NextResponse.json({ text, usage })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz istek', details: error.issues },
        { status: 400 },
      )
    }
    console.error('AI chat hatası:', error)
    const message = error instanceof Error ? error.message : 'Sunucu hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
