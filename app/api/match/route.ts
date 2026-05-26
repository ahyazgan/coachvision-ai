/**
 * Maç koleksiyonu endpoint'i.
 *
 * POST — yeni maç yarat (rakip + tarih + opsiyonel formasyon). Takım yoksa
 *        ilk takımı/placeholder'ı kullanır. Yaratılan maç ID'si döner; UI
 *        ardından /match/[id]/plan'a yönlendirir.
 *
 * GET değil: liste sayfası Server Component'tir, prisma'ya direkt erişir.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth/require'

const BodySchema = z.object({
  awayTeamName: z.string().min(1).max(80),
  date: z.string().refine((s) => !isNaN(Date.parse(s)), 'Geçersiz tarih'),
  competition: z.string().min(1).max(80).default('Maç'),
  formation: z
    .string()
    .regex(/^\d(-\d){1,3}$/, "Geçersiz diziliş (örn '4-3-3')")
    .optional(),
  venue: z.string().max(120).optional(),
})

/**
 * Maç yarat — `homeTeamId` ilk mevcut takımdan veya video upload'ın yarattığı
 * placeholder'dan gelir. Tek-takım iş akışı bu aşama için yeterli; çoklu takım
 * UI sonradan eklenebilir.
 */
async function resolveHomeTeamId(): Promise<string> {
  const team = await prisma.team.findFirst({ select: { id: true } })
  if (team) return team.id

  // Hiç takım yok — placeholder kur (video upload akışıyla aynı)
  const club = await prisma.club.upsert({
    where: { id: 'club-placeholder' },
    create: { id: 'club-placeholder', name: 'Test Kulüp', league: 'Geliştirme' },
    update: {},
  })
  const created = await prisma.team.upsert({
    where: { id: 'team-placeholder' },
    create: {
      id: 'team-placeholder',
      name: 'A Takımı',
      category: 'A',
      clubId: club.id,
    },
    update: {},
  })
  return created.id
}

export async function POST(req: Request) {
  try {
    const guard = await requireSession()
    if (guard instanceof NextResponse) return guard
    const body = BodySchema.parse(await req.json())
    const homeTeamId = await resolveHomeTeamId()

    const match = await prisma.match.create({
      data: {
        homeTeamId,
        awayTeamName: body.awayTeamName,
        date: new Date(body.date),
        competition: body.competition,
        formation: body.formation,
        venue: body.venue,
        status: 'scheduled',
      },
      select: { id: true },
    })

    return NextResponse.json({ id: match.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Match POST hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
