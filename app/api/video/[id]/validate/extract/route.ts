/**
 * Tek bir frame'i çıkar + sistem çıktısı üret (Python proxy).
 *
 * UI'dan saniye konumu gelir, Python cv2 ile frame'i okur, YOLO + tek-frame
 * K-means takım atama yapar, JPEG base64 + normalize tespit listesi döner.
 * Sample henüz DB'ye yazılmaz — kullanıcı elle GT işaretledikten sonra
 * `/api/video/[id]/validate` POST ile kaydedilir.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:8000'

const BodySchema = z.object({
  timeSec: z.number().min(0).max(60 * 60 * 5), // 5 saat üst sınır — savunma
})

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const video = await prisma.matchVideo.findUnique({
      where: { id: params.id },
      select: { id: true, filePath: true, duration: true },
    })
    if (!video) {
      return NextResponse.json({ error: 'Video bulunamadı' }, { status: 404 })
    }

    const body = BodySchema.parse(await req.json())

    const pyRes = await fetch(`${PYTHON_API_URL}/validation/extract-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: video.filePath,
        time_sec: body.timeSec,
      }),
    })
    if (!pyRes.ok) {
      const detail = await pyRes.text().catch(() => '')
      return NextResponse.json(
        { error: `Python servisine ulaşılamadı: ${detail || pyRes.status}` },
        { status: 502 },
      )
    }
    const data = await pyRes.json()
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz istek', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Frame extract hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
