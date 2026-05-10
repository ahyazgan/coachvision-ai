import { NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db/client'

const MAX_BYTES = (Number(process.env.MAX_VIDEO_SIZE_MB ?? 2000)) * 1024 * 1024
const UPLOAD_DIR = process.env.VIDEO_UPLOAD_DIR ?? './uploads/videos'
const PYTHON_API_URL = process.env.PYTHON_API_URL ?? 'http://localhost:8000'

const ALLOWED_EXT = new Set(['mp4', 'mov', 'avi', 'mkv'])
const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
])

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    const matchIdRaw = form.get('matchId')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Dosya gönderilmedi' }, { status: 400 })
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Dosya çok büyük (max ${process.env.MAX_VIDEO_SIZE_MB ?? 2000} MB)` },
        { status: 413 },
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: 'Desteklenmeyen format. Sadece MP4, MOV, AVI, MKV.' },
        { status: 415 },
      )
    }

    // Eşleşen maç yoksa "Yüklenmiş Video" placeholder maçına bağla
    const matchId =
      typeof matchIdRaw === 'string' && matchIdRaw.length > 0
        ? matchIdRaw
        : await ensurePlaceholderMatch()

    // Önce DB kaydı oluştur — id'yi dosya adı olarak kullan
    const video = await prisma.matchVideo.create({
      data: {
        matchId,
        filePath: '', // Aşağıda güncelleyeceğiz
        fileName: file.name,
        fileSize: file.size,
        source: 'upload',
        status: 'uploading',
      },
    })

    const safeFileName = `${video.id}.${ext}`
    const absUploadDir = path.resolve(process.cwd(), UPLOAD_DIR)
    await mkdir(absUploadDir, { recursive: true })
    const filePath = path.join(absUploadDir, safeFileName)

    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, bytes)

    await prisma.matchVideo.update({
      where: { id: video.id },
      data: { filePath, status: 'processing' },
    })

    // Python sunucusunu fire-and-forget tetikle
    void fetch(`${PYTHON_API_URL}/video/process`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        video_id: video.id,
        file_path: filePath,
        match_id: matchId,
      }),
    }).catch(async (err) => {
      console.error('Python tetiklenemedi:', err)
      await prisma.matchVideo.update({
        where: { id: video.id },
        data: { status: 'error', errorMsg: 'Python sunucusuna ulaşılamadı' },
      })
    })

    return NextResponse.json(
      {
        videoId: video.id,
        fileName: file.name,
        size: file.size,
        status: 'processing',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Video yükleme hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}

/** Hızlı yükleme akışı için tek seferlik placeholder maç + takım + kulüp. */
async function ensurePlaceholderMatch(): Promise<string> {
  const existing = await prisma.match.findFirst({
    where: { competition: 'Video Yüklemeleri' },
    select: { id: true },
  })
  if (existing) return existing.id

  const club = await prisma.club.upsert({
    where: { id: 'club-placeholder' },
    create: { id: 'club-placeholder', name: 'Test Kulüp', league: 'Geliştirme' },
    update: {},
  })
  const team = await prisma.team.upsert({
    where: { id: 'team-placeholder' },
    create: { id: 'team-placeholder', name: 'A Takımı', category: 'A', clubId: club.id },
    update: {},
  })
  const match = await prisma.match.create({
    data: {
      homeTeamId: team.id,
      awayTeamName: 'Bilinmeyen',
      date: new Date(),
      competition: 'Video Yüklemeleri',
      status: 'completed',
    },
  })
  return match.id
}
