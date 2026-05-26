/**
 * Saha kalibrasyonu kaydı.
 *
 * UI'dan 4 referans piksel noktası alır → Python'a doğrulatır →
 * `MatchPlan.calibration` JSON'una yazar. Plan yoksa varsayılan değerlerle
 * oluşturulur (calibration alanı doluyken plan yokken anlamsız olur).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/client'

const Point = z.tuple([z.number(), z.number()])
const BodySchema = z.object({
  image_points: z.array(Point).length(4),
  length_m: z.number().min(40).max(150).default(105),
  width_m: z.number().min(20).max(90).default(68),
})

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:8000'

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      include: { plan: true },
    })
    if (!match) {
      return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })
    }

    const body = BodySchema.parse(await req.json())

    // Python homografiyi doğrulasın
    const pyRes = await fetch(`${PYTHON_API_URL}/calibration/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_points: body.image_points,
        length_m: body.length_m,
        width_m: body.width_m,
      }),
    })
    if (!pyRes.ok) {
      return NextResponse.json(
        { error: 'Python doğrulama servisine ulaşılamadı' },
        { status: 502 },
      )
    }
    const validation = (await pyRes.json()) as {
      ok: boolean
      error?: string
      sample_distance_m?: number
    }
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error ?? 'Homografi doğrulanamadı' },
        { status: 400 },
      )
    }

    const worldCorners: Array<[number, number]> = [
      [0, 0],
      [body.length_m, 0],
      [body.length_m, body.width_m],
      [0, body.width_m],
    ]
    const calibration = {
      image_points: body.image_points,
      world_points: worldCorners,
      length_m: body.length_m,
      width_m: body.width_m,
    }

    // Plan varsa update, yoksa minimum default ile yarat (sonra editlenebilir)
    if (match.plan) {
      await prisma.matchPlan.update({
        where: { matchId: params.id },
        data: { calibration },
      })
    } else {
      await prisma.matchPlan.create({
        data: {
          matchId: params.id,
          name: `${match.awayTeamName} maç planı`,
          formation: '4-3-3',
          teamInstructions: {
            defensive_line: 'mid',
            pressing: 'mid',
            possession_style: 'balanced',
            width: 'balanced',
            tempo: 'medium',
            notes: '',
          },
          playerAssignments: [],
          thresholds: {
            compactness_max_m: 38,
            compactness_min_m: 18,
            pressure_min_self: 30,
            pressure_max_opponent: 70,
            wing_imbalance_max: 0.6,
            possession_min_self: 0.4,
          },
          calibration,
          notes: '',
        },
      })
    }

    return NextResponse.json({
      ok: true,
      sample_distance_m: validation.sample_distance_m,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Kalibrasyon POST hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}


export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const plan = await prisma.matchPlan.findUnique({ where: { matchId: params.id } })
    if (!plan) {
      return NextResponse.json({ error: 'Plan bulunamadı' }, { status: 404 })
    }
    await prisma.matchPlan.update({
      where: { matchId: params.id },
      data: { calibration: Prisma.JsonNull },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Kalibrasyon DELETE hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
