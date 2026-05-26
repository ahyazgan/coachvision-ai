/**
 * Doğrulama sample listesi + yeni sample kaydetme + toplu metrikler.
 *
 * GET: bu videoya ait tüm sample'ları ve özet metrik döner (UI sayfası
 *      bunu okur, hem listeleme hem "%X precision" rakamlarını gösterir).
 * POST: tek bir sample kaydeder. Body: { frameTimeSec, groundTruth[],
 *       systemOutput[], imageWidth, imageHeight }.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import {
  computeValidationMetrics,
  type GroundTruthPoint,
  type SystemPoint,
} from '@/lib/validation-metrics'

const PointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})
const GtSchema = PointSchema.extend({ team: z.enum(['A', 'B']) })
const SysSchema = PointSchema.extend({
  team: z.enum(['A', 'B']).nullable(),
  confidence: z.number().min(0).max(1),
})

const SampleSchema = z.object({
  frameTimeSec: z.number().min(0),
  groundTruth: z.array(GtSchema).max(40),
  systemOutput: z.array(SysSchema).max(60),
  imageWidth: z.number().int().min(1).max(10000),
  imageHeight: z.number().int().min(1).max(10000),
})

interface RouteContext {
  params: { id: string }
}

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const video = await prisma.matchVideo.findUnique({
      where: { id: params.id },
      select: { id: true, fileName: true, duration: true },
    })
    if (!video) {
      return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
    }

    const samples = await prisma.validationSample.findMany({
      where: { videoId: params.id },
      orderBy: { frameTimeSec: 'asc' },
    })

    const metrics = computeValidationMetrics(
      samples.map((s) => ({
        groundTruth: s.groundTruth as unknown as GroundTruthPoint[],
        systemOutput: s.systemOutput as unknown as SystemPoint[],
      })),
    )

    return NextResponse.json({
      video: { id: video.id, fileName: video.fileName, duration: video.duration },
      samples,
      metrics,
    })
  } catch (error) {
    console.error('Validation GET hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const video = await prisma.matchVideo.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!video) {
      return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
    }

    const body = SampleSchema.parse(await req.json())
    const saved = await prisma.validationSample.create({
      data: {
        videoId: params.id,
        frameTimeSec: body.frameTimeSec,
        groundTruth: body.groundTruth,
        systemOutput: body.systemOutput,
        imageWidth: body.imageWidth,
        imageHeight: body.imageHeight,
      },
    })
    return NextResponse.json(saved, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Validation POST hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
