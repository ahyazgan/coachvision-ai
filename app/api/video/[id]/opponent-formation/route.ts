/**
 * Rakip diziliş tespiti — Python proxy.
 *
 * UI butonundan tetiklenir; Python örneklediği N kareden takım B'nin Y
 * koordinatlarını çıkarır, K-means ile satırlara böler. Sonuç sayfaya
 * inline gösterilir (kayıt yok — tahmin, hızlı yenilenebilir).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:8000'

const BodySchema = z.object({
  sampleCount: z.number().int().min(3).max(20).default(8),
  team: z.enum(['A', 'B']).default('B'),
})

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const video = await prisma.matchVideo.findUnique({
      where: { id: params.id },
      select: { filePath: true },
    })
    if (!video) {
      return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
    }
    const body = BodySchema.parse(await req.json().catch(() => ({})))

    const pyRes = await fetch(`${PYTHON_API_URL}/opponent/detect-formation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: video.filePath,
        sample_count: body.sampleCount,
        team: body.team,
      }),
    })
    if (!pyRes.ok) {
      const detail = await pyRes.text().catch(() => '')
      return NextResponse.json(
        { error: `Python servisi: ${detail || pyRes.status}` },
        { status: 502 },
      )
    }
    return NextResponse.json(await pyRes.json())
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz istek', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Opponent formation hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
