/**
 * Maç planı CRUD endpoint'i (Football Manager mantığı).
 *
 * GET — mevcut planı döner; yoksa varsayılan plan template'i döner (henüz
 * kaydedilmemiş). PUT — planı oluşturur veya günceller (upsert).
 *
 * Sapma motoru bu plandaki `thresholds` değerlerini referans alır.
 * Python tarafı: `apps/python/services/match_plan.py`.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const TeamInstructionsSchema = z.object({
  defensive_line: z.enum(['low', 'mid', 'high']),
  pressing: z.enum(['low', 'mid', 'high']),
  possession_style: z.enum(['build_up', 'balanced', 'direct']),
  width: z.enum(['narrow', 'balanced', 'wide']),
  tempo: z.enum(['slow', 'medium', 'fast']),
  notes: z.string().max(500).optional().default(''),
})

const ThresholdsSchema = z
  .object({
    compactness_max_m: z.number().min(5).max(80),
    compactness_min_m: z.number().min(5).max(80),
    pressure_min_self: z.number().min(0).max(100),
    pressure_max_opponent: z.number().min(0).max(100),
    wing_imbalance_max: z.number().min(0).max(1),
    possession_min_self: z.number().min(0).max(1),
  })
  .refine((t) => t.compactness_min_m < t.compactness_max_m, {
    message: 'Kompaktlık min eşiği max\'tan küçük olmalı',
    path: ['compactness_min_m'],
  })

const FormationRe = /^\d(-\d){1,3}$/

const PlanSchema = z.object({
  name: z.string().min(1).max(100),
  formation: z
    .string()
    .regex(FormationRe, 'Diziliş biçimi geçersiz (örn. 4-3-3)')
    .refine(
      (f) => f.split('-').reduce((s, n) => s + Number(n), 0) === 10,
      'Diziliş 10 saha oyuncusu olmalı (kaleci hariç)',
    ),
  teamInstructions: TeamInstructionsSchema,
  thresholds: ThresholdsSchema,
  notes: z.string().max(1000).optional().default(''),
})

interface RouteContext {
  params: { id: string }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: { plan: true },
    })
    if (!match) {
      return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })
    }
    return NextResponse.json({
      matchId: match.id,
      opponentName: match.awayTeamName,
      plan: match.plan, // null olabilir — UI varsayılan template gösterir
    })
  } catch (error) {
    console.error('Plan GET hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!match) {
      return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })
    }

    const body = await req.json()
    const data = PlanSchema.parse(body)

    const saved = await prisma.matchPlan.upsert({
      where: { matchId: params.id },
      create: {
        matchId: params.id,
        name: data.name,
        formation: data.formation,
        teamInstructions: data.teamInstructions,
        playerAssignments: [],
        thresholds: data.thresholds,
        notes: data.notes ?? '',
      },
      update: {
        name: data.name,
        formation: data.formation,
        teamInstructions: data.teamInstructions,
        thresholds: data.thresholds,
        notes: data.notes ?? '',
      },
    })

    return NextResponse.json(saved)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz plan', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Plan PUT hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
