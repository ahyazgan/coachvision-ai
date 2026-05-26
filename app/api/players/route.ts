/**
 * Oyuncu koleksiyonu endpoint'i.
 *
 * POST — yeni oyuncu yarat. Takım yoksa /api/match'taki resolveHomeTeamId
 *        mantığını paylaşır (placeholder kulüp + takım kurar).
 * GET — kadroyu liste olarak döner (squad page Server Component'tir,
 *       genelde Prisma'ya doğrudan erişir; bu endpoint dış entegrasyonlar için).
 */
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { requireSession } from '@/lib/auth/require'

const BodySchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  jerseyNumber: z.number().int().min(1).max(99),
  position: z.enum(['GK', 'DF', 'MF', 'FW']),
  birthDate: z.string().refine((s) => !isNaN(Date.parse(s)), 'Geçersiz tarih'),
  nationality: z.string().max(3).optional(),
  height: z.number().int().min(140).max(220).optional(),
  weight: z.number().int().min(40).max(150).optional(),
  preferredFoot: z.enum(['left', 'right', 'both']).optional(),
})

async function resolveTeamId(): Promise<string> {
  const team = await prisma.team.findFirst({ select: { id: true } })
  if (team) return team.id
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
    const data = BodySchema.parse(await req.json())
    const teamId = await resolveTeamId()

    const player = await prisma.player.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        jerseyNumber: data.jerseyNumber,
        position: data.position,
        birthDate: new Date(data.birthDate),
        nationality: data.nationality,
        height: data.height,
        weight: data.weight,
        preferredFoot: data.preferredFoot,
        teamId,
      },
      select: { id: true },
    })

    return NextResponse.json({ id: player.id }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.issues },
        { status: 400 },
      )
    }
    // Unique constraint (aynı takımda aynı forma numarası)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Bu forma numarası bu takımda zaten kayıtlı' },
        { status: 409 },
      )
    }
    console.error('Player POST hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const team = await prisma.team.findFirst({ select: { id: true } })
    if (!team) return NextResponse.json({ players: [] })
    const players = await prisma.player.findMany({
      where: { teamId: team.id },
      orderBy: [{ position: 'asc' }, { jerseyNumber: 'asc' }],
    })
    return NextResponse.json({ players })
  } catch (error) {
    console.error('Player GET hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
