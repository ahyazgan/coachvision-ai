/** Tek bir doğrulama sample'ı silme. */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'

interface RouteContext {
  params: { id: string; sampleId: string }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const sample = await prisma.validationSample.findUnique({
      where: { id: params.sampleId },
      select: { videoId: true },
    })
    if (!sample || sample.videoId !== params.id) {
      return NextResponse.json({ error: 'Sample bulunamadı' }, { status: 404 })
    }
    await prisma.validationSample.delete({ where: { id: params.sampleId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Validation DELETE hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
