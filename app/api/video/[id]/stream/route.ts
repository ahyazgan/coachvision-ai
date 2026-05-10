import { NextResponse } from 'next/server'
import { createReadStream, statSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/db/client'

export const runtime = 'nodejs'

/** Yüklenen video dosyasını HTTP Range desteğiyle stream et. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const video = await prisma.matchVideo.findUnique({
    where: { id: params.id },
    select: { filePath: true, fileName: true },
  })
  if (!video || !video.filePath) {
    return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })
  }

  // Path traversal guard: filePath sadece uploads/videos altında olabilir
  const uploadsAbs = path.resolve(process.cwd(), process.env.VIDEO_UPLOAD_DIR ?? './uploads/videos')
  const fileAbs = path.resolve(video.filePath)
  if (!fileAbs.startsWith(uploadsAbs)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  let stat
  try {
    stat = statSync(fileAbs)
  } catch {
    return NextResponse.json({ error: 'Dosya yok' }, { status: 404 })
  }

  const total = stat.size
  const range = req.headers.get('range')
  const ext = video.fileName.split('.').pop()?.toLowerCase() ?? 'mp4'
  const contentType = mimeFor(ext)

  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range)
    if (!match) return new NextResponse(null, { status: 416 })
    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : total - 1
    if (start >= total || end >= total) return new NextResponse(null, { status: 416 })

    const stream = createReadStream(fileAbs, { start, end })
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers: {
        'content-range': `bytes ${start}-${end}/${total}`,
        'accept-ranges': 'bytes',
        'content-length': String(end - start + 1),
        'content-type': contentType,
        'cache-control': 'no-cache',
      },
    })
  }

  const stream = createReadStream(fileAbs)
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'content-length': String(total),
      'content-type': contentType,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
    },
  })
}

function mimeFor(ext: string): string {
  switch (ext) {
    case 'mp4':
      return 'video/mp4'
    case 'mov':
      return 'video/quicktime'
    case 'avi':
      return 'video/x-msvideo'
    case 'mkv':
      return 'video/x-matroska'
    default:
      return 'application/octet-stream'
  }
}
