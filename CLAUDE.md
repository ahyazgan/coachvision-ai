# CLAUDE.md — CoachVision AI Geliştirme Kuralları

Bu dosya, Claude Code'un projeyi geliştirirken **her seferinde okuduğu** kurallar dosyasıdır. PROJECT_BRIEF.md vizyonu anlatır, bu dosya **nasıl kod yazılacağını** anlatır.

---

## 🎯 KOD YAZIM KURALLARI

### 1. Genel Prensipler

- **TypeScript her yerde.** `any` kullanma. `unknown` ile başla, daralt.
- **Strict mode açık.** `tsconfig.json` strict olsun.
- **Fonksiyonel programlama** önceliği. Sınıflar sadece gerektiğinde.
- **Saf fonksiyonlar** tercih et. Yan etkileri minimize et.
- **Erken dönüş** (early return) ile yuvalanmış if'lerden kaçın.
- **DRY** ama abartma. Bazen tekrar daha okunaklıdır.
- **Yorumlar Türkçe.** Kod İngilizce, yorumlar Türkçe.

### 2. Dosya & Klasör İsimlendirme

```
✅ DOĞRU:
- components/PlayerCard.tsx       (PascalCase bileşenler)
- lib/calculate-fitness.ts        (kebab-case yardımcılar)
- app/squad/page.tsx              (Next.js standart)
- types/match.ts                  (kebab-case tip dosyaları)

❌ YANLIŞ:
- components/playerCard.tsx
- lib/calculateFitness.ts
- types/Match.ts
```

### 3. React Bileşenleri

```tsx
'use client'  // Sadece gerektiğinde

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface PlayerCardProps {
  player: Player
  onSelect?: (id: string) => void
  variant?: 'compact' | 'full'
  className?: string
}

export function PlayerCard({
  player,
  onSelect,
  variant = 'full',
  className
}: PlayerCardProps) {
  const [hovered, setHovered] = useState(false)
  const isInjured = player.injuries.some(i => !i.actualReturn)

  const handleClick = () => {
    onSelect?.(player.id)
  }

  if (!player) return null

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4',
        variant === 'compact' && 'p-2',
        className
      )}
      onClick={handleClick}
    >
      {/* içerik */}
    </div>
  )
}
```

### 4. Server vs Client Components

- **Default: Server Component.** `'use client'` sadece gerektiğinde.
- Client gerektirir: `useState`, `useEffect`, event handlers, browser API'leri
- Server tercih: Veri çekme, statik içerik, SEO

### 5. API Routes

```ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { getServerSession } from 'next-auth'

const CreatePlayerSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  jerseyNumber: z.number().int().min(1).max(99),
  position: z.enum(['GK', 'DF', 'MF', 'FW']),
  teamId: z.string().cuid(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await req.json()
    const data = CreatePlayerSchema.parse(body)

    const player = await prisma.player.create({ data })
    return NextResponse.json(player, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Player oluşturma hatası:', error)
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
  }
}
```

### 6. State Management (Zustand)

Karmaşık global state için Zustand kullan. Tek modül-state için `useState` yeter.

### 7. Veri Çekme

- Server Component'larda direkt Prisma
- Client Component'larda SWR
- Mutasyonlar Server Actions

### 8. Tailwind Stili

`cn()` helper'ını her zaman kullan. Renk değişkenleri (`bg-primary`, `text-muted-foreground`). Mobile-first responsive.

### 9. Form

React Hook Form + Zod resolver.

### 10. Hata Yönetimi

`try/catch` her async işlemde. `ValidationError` gibi tipli hata sınıfları.

---

## 🎬 VİDEO + PYTHON BACKEND KURALLARI

### Node.js ↔ Python Köprüsü

- Node.js: Video upload alır, dosyayı `uploads/videos/` altına yazar, `MatchVideo` kaydı oluşturur, sonra Python'a `POST /process` ile job tetikler.
- Python: İşlemeyi background task olarak yapar, ilerlemeyi WebSocket ile döker.
- **Asla** Node.js'te FFmpeg/OpenCV çalıştırma. Tüm video işi Python'da.

### Video Yükleme Kuralları

1. Maksimum 2 GB (`MAX_VIDEO_SIZE_MB`)
2. Format whitelist: `mp4`, `mov`, `avi`, `mkv`
3. MIME-type **ve** uzantı kontrolü
4. Dosya adı sanitize et — kullanıcı girdisini path'e ekleme
5. CUID ile yeniden adlandır: `<videoId>.<ext>`
6. Yükleme bitince `status: uploading → processing`

### Python Pipeline Kuralları

- **Frame aralığı:** `FRAME_INTERVAL_SECONDS=2` (her 2 sn'de 1 frame)
- **Model:** `yolov8n.pt` (nano)
- **Güven eşiği:** 0.6 — altındakileri elle
- **Sınıf filtresi:** Sadece `person` (class 0)
- **Temizlik:** Frame'leri analiz sonrası sil
- **Hata:** Try/except ile sar, `MatchVideo.status = 'error'`
- **Progress:** WebSocket ile `{progress: 0-100}`

### WebSocket

```python
@app.websocket("/ws/video/{video_id}")
async def video_progress(ws: WebSocket, video_id: str):
    await ws.accept()
    # ...
```

Frontend: doğrudan `WebSocket` API.

---

## 🤖 AI ENTEGRASYONU

### Claude Wrapper

```ts
// lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function askClaude({
  systemPrompt,
  messages,
  model = 'claude-sonnet-4-20250514',
  maxTokens = 1024,
}: {
  systemPrompt: string
  messages: Anthropic.MessageParam[]
  model?: string
  maxTokens?: number
}) {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  })

  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => (b as Anthropic.TextBlock).text)
    .join('\n')

  return { text, usage: response.usage }
}
```

### Maliyet Kontrolü

- Sonnet varsayılan, Opus sadece karmaşık analiz
- Token: 1024 üstüne çıkma
- Video analizi Python tarafında **max 300 token/istek**
- Kullanıcı başına günlük 50 sorgu limit
- Konuşma geçmişi son 10 mesaj

---

## 🗄️ VERİTABANI

```ts
import { prisma } from '@/lib/db/client'

const players = await prisma.player.findMany({
  select: { id: true, firstName: true, lastName: true, jerseyNumber: true }
})

await prisma.$transaction(async (tx) => { /* ... */ })
```

### Migration

- Her şema değişikliği yeni migration
- Açıklayıcı isim: `add_match_video_table`
- Yıkıcı değişiklikleri 2 aşamalı yap

---

## 🔒 GÜVENLİK

1. Şifre asla loglanmaz, asla plain text DB'de
2. API key sadece `.env`
3. **Video upload:** path traversal kontrolü, MIME check, boyut limiti
4. CORS sadece güvenilir origin'ler
5. Rate limiting özellikle `/api/video/upload`'a
6. SQL injection: Prisma kullan, raw query yazma
7. `dangerouslySetInnerHTML` yok
8. Sağlık verisi şifreli sakla
9. PII loglama yok

---

## 🧪 TEST

- **Vitest** birim testleri
- **pytest** Python tarafı (`apps/python/tests/`)
- **Playwright** kritik akışlar (giriş, video yükleme, analiz, rapor PDF)

---

## 📦 PAKETLER

### İzinli

`next`, `react`, `typescript`, `@prisma/client`, `next-auth`, `@anthropic-ai/sdk`, `zustand`, `zod`, `react-hook-form`, `framer-motion`, `recharts`, `d3`, `react-dropzone`, `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `date-fns`.

### Yasak

jQuery, Moment.js, Lodash, Bootstrap, Material UI.

### Eklemeden önce

Bundle boyutu, bakım durumu, alternatif kontrol.

---

## 🔬 GELİŞTİRME AKIŞI

1. Plan yap
2. Tipler önce
3. API endpoint
4. UI bileşeni
5. Test
6. Manuel test
7. Commit

### Commit

```
✅ feat: video yükleme drag & drop eklendi
✅ feat(python): YOLOv8 oyuncu tespiti entegre edildi
✅ fix: WebSocket progress güncellenmiyor sorunu giderildi

❌ "update", "fix bug", "wip"
```

---

## 🚀 PERFORMANS

- Next.js Image, `dynamic()` lazy load
- Memoization sadece ölçtükten sonra
- Database index sık sorgulanan alanlara
- SWR cache
- Python tarafında frame batch işleme, GPU varsa kullan

---

## ♿ ERİŞİLEBİLİRLİK & 📱 MOBİL

- Semantik HTML, ARIA labels
- WCAG AA kontrast (4.5:1)
- Mobile-first Tailwind, dokunmatik 44x44px
- PWA hazırlığı

---

## 🚨 ASLA YAPMA

- ❌ `any` tipi
- ❌ Kod içine API key
- ❌ Prod'a `console.log`
- ❌ Node.js'te FFmpeg/OpenCV çalıştırma
- ❌ N+1 sorgu
- ❌ Şifre plain text
- ❌ Migration olmadan şema değiştirme
- ❌ Sanitize edilmemiş upload path
- ❌ Frame'leri analiz sonrası bırakma

---

## ✅ HER ZAMAN YAP

- ✅ Önce planla
- ✅ TypeScript strict
- ✅ Hata yakalama (Python'da try/except)
- ✅ Loading + boş state
- ✅ Türkçe UI
- ✅ Mobil test
- ✅ Anlamlı commit mesajı

---

Kalite > Hız. **Doğru yapılan iş, hızlı yapılan iştir.**
