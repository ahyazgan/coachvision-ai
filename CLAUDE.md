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
// ✅ DOĞRU
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
  // Hooks önce
  const [hovered, setHovered] = useState(false)

  // Türetilmiş değerler
  const isInjured = player.injuries.some(i => !i.actualReturn)

  // Event handlers
  const handleClick = () => {
    onSelect?.(player.id)
  }

  // Erken dönüş edge cases
  if (!player) return null

  // Render
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

### 4. Server Components vs Client Components

- **Default: Server Component.** `'use client'` sadece gerektiğinde.
- Client gerektirir: `useState`, `useEffect`, event handlers, browser API'leri
- Server tercih: Veri çekme, statik içerik, SEO

### 5. API Routes

```ts
// app/api/players/route.ts
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
    // 1. Auth kontrol
    const session = await getServerSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    // 2. Veri doğrulama
    const body = await req.json()
    const data = CreatePlayerSchema.parse(body)

    // 3. İş mantığı
    const player = await prisma.player.create({ data })

    // 4. Yanıt
    return NextResponse.json(player, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Geçersiz veri', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Player oluşturma hatası:', error)
    return NextResponse.json(
      { error: 'Sunucu hatası' },
      { status: 500 }
    )
  }
}
```

### 6. State Management (Zustand)

Karmaşık global state için Zustand kullan:

```ts
// lib/stores/match-store.ts
import { create } from 'zustand'

interface MatchStore {
  currentMatch: Match | null
  events: MatchEvent[]
  setCurrentMatch: (match: Match) => void
  addEvent: (event: MatchEvent) => void
  reset: () => void
}

export const useMatchStore = create<MatchStore>((set) => ({
  currentMatch: null,
  events: [],
  setCurrentMatch: (match) => set({ currentMatch: match }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  reset: () => set({ currentMatch: null, events: [] }),
}))
```

### 7. Veri Çekme Stratejisi

- **Server Component'larda:** Direkt Prisma çağrı
- **Client Component'larda:** SWR veya React Query
- **Mutasyonlar:** Server Actions tercih et

```ts
// Server Component örneği
export default async function SquadPage() {
  const players = await prisma.player.findMany({
    where: { teamId: 'xxx' },
    include: { stats: true }
  })
  return <SquadList players={players} />
}
```

### 8. Stil Kuralları (Tailwind)

```tsx
// ✅ DOĞRU - cn() helper kullan
<div className={cn(
  "flex items-center gap-2 p-4",
  "bg-card border border-border rounded-lg",
  "hover:bg-accent/10 transition-colors",
  isActive && "ring-2 ring-primary",
  className
)}>

// ❌ YANLIŞ - inline string concat
<div className={`flex p-4 ${isActive ? 'bg-blue' : ''}`}>
```

- **Renk değişkenleri** kullan (`bg-primary`, `text-muted-foreground`)
- **Utility-first** ama 5+ class olunca @apply düşün
- **Responsive:** `sm:`, `md:`, `lg:` ile mobil-first

### 9. Form Yönetimi

React Hook Form + Zod kullan:

```tsx
const formSchema = z.object({
  firstName: z.string().min(2, 'En az 2 karakter'),
  lastName: z.string().min(2, 'En az 2 karakter'),
})

const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { firstName: '', lastName: '' },
})
```

### 10. Hata Yönetimi

```ts
// Hata sınıfları
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// try-catch her async işlemde
try {
  const result = await someAsyncOp()
} catch (error) {
  if (error instanceof ValidationError) {
    // Kullanıcıya göster
  } else {
    console.error('Beklenmeyen hata:', error)
    // Sentry'e gönder
  }
}
```

---

## 🤖 AI ENTEGRASYONU KURALLARI

### Claude API Kullanımı

```ts
// lib/ai/claude.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export async function askClaude({
  systemPrompt,
  messages,
  model = 'claude-sonnet-4-5',
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

### Sistem Prompt'u Hazırlama

```ts
// lib/ai/prompts.ts
export function buildCoachContext(match: Match, players: Player[]) {
  return `Sen profesyonel bir futbol antrenör asistanısın. Türkçe konuşuyorsun.

Mevcut Maç Bağlamı:
- Skor: ${match.homeScore}-${match.awayScore}
- Dakika: ${match.minute}
- Formasyon: ${match.formation}
- Yorgun oyuncular: ${players.filter(p => p.fatigue > 70).map(p => p.lastName).join(', ')}

Görevin:
- Kısa, net, pratik tavsiyeler ver
- Taktik terminolojisi kullan
- Maximum 3-4 cümle
- Emoji kullan (⚡🎯⚠️)
- "Bence" yerine "Önerim:" başlat
`
}
```

### Maliyet Kontrolü

- Sonnet'i varsayılan kullan (ucuz)
- Opus sadece **karmaşık analiz** için (pahalı)
- Token sayısı 1024'ü geçmesin (özel durumlar hariç)
- Kullanıcı başına **günlük 50 sorgu** limit
- Konuşma geçmişini **son 10 mesaj** ile sınırla

### Tracking & ML Kuralları

- TensorFlow.js modellerini **lazy load** et
- Model dosyaları **public/models/** içinde
- Inference web worker'da çalışsın (UI bloklamasın)
- Saha kalibrasyonu olmadan ölçüm verme
- Düşük güven (<0.7) tespitlerini gösterme

---

## 🗄️ VERİTABANI KURALLARI

### Prisma Kullanımı

```ts
// ✅ DOĞRU - Tek client
import { prisma } from '@/lib/db/client'

// ✅ DOĞRU - Select sadece gereken alanları
const players = await prisma.player.findMany({
  select: {
    id: true,
    firstName: true,
    lastName: true,
    jerseyNumber: true,
  }
})

// ✅ DOĞRU - Transaction kullan
await prisma.$transaction(async (tx) => {
  const player = await tx.player.create({ data: playerData })
  await tx.playerStat.create({ data: { playerId: player.id, ...stats } })
})
```

### Migration Kuralları

- Her şema değişikliği yeni migration ile
- Migration adları açıklayıcı: `add_injury_severity_field`
- Production'da `prisma migrate deploy`, dev'de `prisma migrate dev`
- Yıkıcı değişiklikleri 2 aşamalı yap (önce ekle, sonra eski sil)

---

## 🔒 GÜVENLİK KURALLARI

1. **Şifreler:** Asla loglama, asla DB'ye plain text
2. **API Keys:** Sadece `.env`, asla kod içinde
3. **CORS:** Sadece güvenilir origin'ler
4. **Rate limiting:** Tüm public endpoint'lere
5. **SQL injection:** Prisma kullandığın için güvende, ama raw query kullanma
6. **XSS:** React varsayılan koruma var, ama `dangerouslySetInnerHTML` kullanma
7. **CSRF:** NextAuth otomatik koruyor
8. **Hassas veri:** Sağlık verisi şifreli sakla
9. **Logging:** PII (kişisel bilgi) loglama

---

## 🧪 TEST KURALLARI

### Birim Testleri (Vitest)

```ts
// lib/calculate-fitness.test.ts
import { describe, it, expect } from 'vitest'
import { calculateACWR } from './calculate-fitness'

describe('calculateACWR', () => {
  it('akut yük 0 ise 0 dönmeli', () => {
    expect(calculateACWR(0, 100)).toBe(0)
  })

  it('1.0-1.5 arası optimal', () => {
    const result = calculateACWR(120, 100)
    expect(result).toBeGreaterThanOrEqual(1.0)
    expect(result).toBeLessThanOrEqual(1.5)
  })
})
```

### E2E Testleri (Playwright)

Kritik akışlar için:
- Giriş yapma
- Oyuncu ekleme
- Maç oluşturma
- AI sohbet

---

## 📦 PAKETLER

### İzinli Paketler

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "typescript": "5.x",
    "@prisma/client": "latest",
    "next-auth": "^4",
    "@anthropic-ai/sdk": "latest",
    "@tensorflow/tfjs": "latest",
    "@tensorflow-models/coco-ssd": "latest",
    "@mediapipe/pose": "latest",
    "zustand": "latest",
    "zod": "latest",
    "react-hook-form": "latest",
    "framer-motion": "latest",
    "recharts": "latest",
    "d3": "latest",
    "tailwindcss": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest",
    "date-fns": "latest"
  }
}
```

### Yasak Paketler

- jQuery (modern React projesinde gerek yok)
- Moment.js (date-fns kullan, daha hafif)
- Lodash (büyük, modern JS yeterli)
- Bootstrap (Tailwind kullanıyoruz)
- Material UI (shadcn/ui kullanıyoruz)

### Yeni paket eklemeden önce:

1. Bundle boyutuna bak (bundlephobia.com)
2. Bakım durumu (son güncelleme, açık issue)
3. Alternatif var mı düşün
4. Tek kullanım için yazıp geç

---

## 🔬 GELİŞTİRME AKIŞI

### Yeni Özellik Eklerken

1. **Plan yap.** Ne yapacağını yazılı söyle.
2. **Tipler önce.** Önce TypeScript tiplerini tanımla.
3. **API endpoint.** Backend mantığı.
4. **UI bileşeni.** Frontend.
5. **Test yaz.** En azından kritik fonksiyonlara.
6. **Manuel test.** Tarayıcıda dene.
7. **Commit.** Anlamlı mesajla.

### Commit Mesajları

```
✅ feat: oyuncu detay sayfasına radar grafik eklendi
✅ fix: maç skoru güncellenemiyor sorunu giderildi
✅ refactor: AI prompt builder fonksiyonel hale getirildi
✅ docs: README'ye kurulum talimatları eklendi
✅ style: PlayerCard renk paleti güncellendi

❌ "update"
❌ "fix bug"
❌ "wip"
```

### Branş Stratejisi

```
main          → Production-ready
develop       → Aktif geliştirme
feature/*     → Yeni özellikler
fix/*         → Bug fix'ler
```

---

## 🚀 PERFORMANS

1. **Resimler:** Next.js Image bileşeni (otomatik optimize)
2. **Lazy loading:** Ağır bileşenler `dynamic()` ile
3. **Memoization:** `useMemo`, `useCallback` ölçtükten sonra ekle
4. **Bundle analizi:** `@next/bundle-analyzer` ile takip et
5. **Database indexler:** Sık sorgulanan alanlara index
6. **Cache:** React Query / SWR ile otomatik cache
7. **CDN:** Statik varlıklar Vercel CDN'den

---

## 🌍 İ18N (Çoklu Dil)

İlk versiyonda sadece Türkçe ama yapı çoklu dile hazır olsun:

```
locales/
├── tr.json    # Türkçe (varsayılan)
├── en.json    # İngilizce (sonra)
└── ar.json    # Arapça (sonra)
```

Sabit metinleri `t('key')` ile kullan.

---

## ♿ ERİŞİLEBİLİRLİK

1. **Semantik HTML:** `<button>`, `<nav>`, `<main>`
2. **ARIA labels:** İkon-only butonlara
3. **Klavye navigasyonu:** Tab ile her şey erişilebilir
4. **Kontrast:** WCAG AA minimum (4.5:1)
5. **Focus durumu:** Görünür olsun
6. **Renk körlüğü:** Sadece renkle bilgi verme

---

## 📱 MOBİL UYUM

1. **Mobile-first** Tailwind
2. **Dokunmatik hedef:** Min 44x44px
3. **Viewport meta:** `width=device-width, initial-scale=1`
4. **PWA hazırlığı:** manifest.json + service worker
5. **Test cihazlar:** iPhone SE (küçük), iPad, Android orta sınıf

---

## 🚨 ASLA YAPMA

- ❌ `any` tipi kullanma
- ❌ Kod içine API key koyma
- ❌ Prod'a `console.log` bırakma
- ❌ DB sorgusunda N+1 problem
- ❌ Şifreyi plain text saklama
- ❌ Migration olmadan şema değiştirme
- ❌ Test olmadan kritik mantık ekleme
- ❌ TODO'ları unutma (issue aç)
- ❌ Kullanıcı verisini izinsiz topla
- ❌ Loading state olmayan async işlem

---

## ✅ HER ZAMAN YAP

- ✅ Önce planla, sonra kod
- ✅ TypeScript strict
- ✅ Hata yakalama
- ✅ Loading state göster
- ✅ Boş state göster
- ✅ Türkçe UI
- ✅ Mobil test et
- ✅ Performans düşün
- ✅ Erişilebilirlik düşün
- ✅ Güvenlik düşün
- ✅ Anlamlı commit mesajı
- ✅ Karmaşık mantığa yorum
- ✅ README'yi güncel tut

---

## 🔄 DEVAM ETMEK

Bu dosyaya **her seferinde başvur**. Yeni özellik eklerken, kod yazmadan önce, hata aldığında.

Kalite > Hız. **Doğru yapılan iş, hızlı yapılan iştir.**

İyi kodlamalar! 🚀
