import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/client'

const FrameSchema = z.object({
  minute: z.number().int(),
  second: z.number().int().optional(),
  frame_number: z.number().int().optional(),
  timestamp: z.number().optional(),
  player_count_a: z.number().int(),
  player_count_b: z.number().int(),
  outlier_count: z.number().int().optional(),
  zones_a: z.record(z.string(), z.number()),
  zones_b: z.record(z.string(), z.number()),
  compactness_a: z.number(),
  compactness_b: z.number(),
  pressure_score: z.number(),
  heatmap_a: z.array(z.array(z.number())).optional(),
  heatmap_b: z.array(z.array(z.number())).optional(),
})

const PreviewSchema = z.object({
  name: z.string(),
  timestamp_sec: z.number(),
  player_count: z.number().int(),
  outliers: z.number().int().optional(),
})

const PayloadSchema = z.object({
  frames_analyzed: z.number().int(),
  frames_skipped: z.number().int().optional(),
  duration_sec: z.number().optional(),
  frames: z.array(FrameSchema),
  ai_advice: z.string().nullable().optional(),
  previews: z.array(PreviewSchema).optional(),
})

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data = PayloadSchema.parse(body)

    const video = await prisma.matchVideo.findUnique({
      where: { id: params.id },
      select: { id: true, matchId: true },
    })
    if (!video) {
      return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
    }

    // Frame analizlerini topluca yaz — sadece anlamlı oyuncu tespiti olanları
    const analyses = data.frames
      .filter((f) => f.player_count_a + f.player_count_b > 0)
      .map((f) => ({
        matchId: video.matchId,
        videoId: video.id,
        minute: f.minute,
        frameNumber: f.frame_number ?? null,
        timestamp: f.timestamp ?? null,
        playerCountA: f.player_count_a,
        playerCountB: f.player_count_b,
        confidence: 0.7, // Pipeline ortalaması — ileride frame başına gelecek
        zonesA: f.zones_a,
        zonesB: f.zones_b,
        compactnessA: f.compactness_a,
        compactnessB: f.compactness_b,
        pressureScore: f.pressure_score,
        heatmapA: f.heatmap_a ?? Prisma.JsonNull,
        heatmapB: f.heatmap_b ?? Prisma.JsonNull,
        aiAdvice: null,
      }))

    await prisma.$transaction([
      prisma.analysis.createMany({ data: analyses }),
      prisma.matchVideo.update({
        where: { id: video.id },
        data: {
          status: 'done',
          progress: 100,
          frameCount: data.frames_analyzed,
          duration: data.duration_sec ? Math.round(data.duration_sec) : null,
        },
      }),
    ])

    // AI özeti varsa son analiz kaydına bağla
    if (data.ai_advice && analyses.length > 0) {
      const lastMinute = Math.max(...analyses.map((a) => a.minute))
      await prisma.analysis.updateMany({
        where: { videoId: video.id, minute: lastMinute },
        data: { aiAdvice: data.ai_advice },
      })
    }

    return NextResponse.json({ ok: true, analyses_saved: analyses.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Complete callback hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
