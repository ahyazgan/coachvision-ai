/**
 * Canlı oturum bittiğinde Python'dan dönen session summary'sini DB'ye yazar.
 *
 * LiveCameraBroadcast kullanıcı "Durdur"a basınca /live/stop çağırır;
 * dönen `summary.commands_history` ve `summary.events_history`'yi buraya
 * post eder. Burada hepsini `MatchEvent` tablosuna yazıp, Match status'unu
 * 'completed' yapıyoruz. Sonraki adım: /match/[id]/uyum sayfasında özet.
 *
 * Event tipi şeması:
 *   - "command:<rule_id>"  → sapma uyarısı (RİSK/DİKKAT/FIRSAT)
 *   - "live:<type>"        → olay (possession_switch, high_pressure)
 *
 * Aynı maça yeniden post edilirse mevcut MatchEvent'leri korur, yenileri ekler
 * (idempotent değil — tek seferlik finish beklenir; bilinçli "yeniden başlat"
 * akışı varsa frontend tarafında engellenir).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'

const CommandSchema = z.object({
  rule_id: z.string(),
  severity: z.enum(['RISK', 'WARN', 'OPPORTUNITY']),
  title: z.string(),
  text: z.string(),
  minute: z.number().int().nonnegative(),
  second: z.number().int().nonnegative(),
  details: z.record(z.string(), z.unknown()).optional().default({}),
})

const EventSchema = z.object({
  type: z.string(),
  minute: z.number().int().nonnegative(),
  second: z.number().int().nonnegative(),
  text: z.string(),
  details: z.record(z.string(), z.unknown()).optional().default({}),
})

const BodySchema = z.object({
  summary: z.object({
    session_id: z.string(),
    frames_processed: z.number().int().nonnegative(),
    elapsed_sec: z.number().nonnegative(),
    commands_total: z.number().int().nonnegative(),
    commands_history: z.array(CommandSchema),
    events_total: z.number().int().nonnegative(),
    events_history: z.array(EventSchema),
    ball: z
      .object({
        visibility: z.number(),
        possession: z.object({
          a: z.number(),
          b: z.number(),
          unknown: z.number(),
        }),
      })
      .passthrough(),
  }),
})

interface RouteContext {
  params: { id: string }
}

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!match) {
      return NextResponse.json({ error: 'Maç bulunamadı' }, { status: 404 })
    }

    const body = BodySchema.parse(await req.json())
    const { summary } = body

    const commandRows = summary.commands_history.map((c) => ({
      matchId: params.id,
      minute: c.minute,
      type: `command:${c.rule_id}`,
      details: {
        severity: c.severity,
        title: c.title,
        text: c.text,
        second: c.second,
        ...(c.details ?? {}),
      },
    }))

    const eventRows = summary.events_history.map((e) => ({
      matchId: params.id,
      minute: e.minute,
      type: `live:${e.type}`,
      details: {
        text: e.text,
        second: e.second,
        ...(e.details ?? {}),
      },
    }))

    const allRows = [...commandRows, ...eventRows]

    if (allRows.length > 0) {
      await prisma.matchEvent.createMany({ data: allRows })
    }

    await prisma.match.update({
      where: { id: params.id },
      data: { status: 'completed' },
    })

    return NextResponse.json({
      ok: true,
      written: allRows.length,
      commands: commandRows.length,
      events: eventRows.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.issues },
        { status: 400 },
      )
    }
    console.error('Finish endpoint hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
