# CoachVision AI

Futbol antrenörleri için yapay zeka destekli **video analiz platformu**. Maç videosunu yükle, AI takım dizilişini, kompaktlığı ve presi analiz etsin; Türkçe taktik tavsiye versin.

> 🇹🇷 Türkçe öncelik · Next.js 14 + Python FastAPI · YOLOv8 + Claude Sonnet 4

## ✨ Özellikler

- **Video yükleme** — drag & drop, MP4/MOV/AVI/MKV, max 2 GB
- **Oyuncu tespiti** — YOLOv8 (nano), confidence ≥ 0.6
- **Takım ayrımı** — K-means ile forma rengi kümeleme
- **Saha tespiti** — HSV yeşil maske
- **Taktik metrikleri** — 3x3 bölge dağılımı, dikey kompaktlık (m), pres yoğunluğu (0-100), ısı haritası
- **AI Koç** — Claude API ile Türkçe maç-özeti taktik yorum
- **Canlı progress** — WebSocket ile frame frame ilerleme yayını

## 🏗️ Mimari

```
Tarayıcı                 Next.js (3000)              Python (8000)
  │  drag&drop video     │                             │
  │ ────────────────────▶│  /api/video/upload          │
  │                      │  → MatchVideo (Prisma)      │
  │                      │  → POST /video/process ────▶│ FastAPI
  │  WebSocket           │                             │ ├─ cv2.VideoCapture
  │ ◀──────────────────────────────────────────────────│ ├─ YOLOv8
  │  progress %                                        │ ├─ K-means
  │                      │                             │ ├─ Bölge analizi
  │                      │  /api/video/[id]/complete ◀─│ └─ Claude API
  │                      │  → Analysis.createMany     
  │  /video/[id] sayfası │
  │ ◀────────────────────│  AnalysisDashboard
```

## 🛠️ Teknolojiler

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind, shadcn/ui
- **Backend (Node):** Next.js API Routes, NextAuth, Prisma
- **Backend (Python):** FastAPI, Uvicorn, OpenCV, Ultralytics (YOLOv8), scikit-learn, Anthropic SDK
- **DB:** SQLite (dev) — Prisma şeması ile Postgres'e taşınabilir
- **AI:** Claude Sonnet 4 (`claude-sonnet-4-20250514`)

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+ ve `pnpm` (`npm i -g pnpm`)
- Python 3.11+ (3.14 ile de test edildi)
- Git
- (Opsiyonel) [Anthropic API key](https://console.anthropic.com) — yoksa AI tavsiye atlanır

### 1. Klonla ve frontend bağımlılıklarını yükle

```bash
git clone https://github.com/ahyazgan/coachvision-ai.git
cd coachvision-ai
pnpm install
```

### 2. `.env.local` oluştur

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="dev-secret-change-in-production-please-32chars"
NEXTAUTH_URL="http://localhost:3000"
ANTHROPIC_API_KEY="sk-ant-api03-..."
PYTHON_API_URL="http://localhost:8000"
NEXT_PUBLIC_PYTHON_WS_URL="ws://localhost:8000"
MAX_VIDEO_SIZE_MB=2000
VIDEO_UPLOAD_DIR="./uploads/videos"
FRAME_INTERVAL_SECONDS=2
```

Prisma'nın okuması için aynı `DATABASE_URL`'i `.env` dosyasına da koy:

```env
DATABASE_URL="file:./dev.db"
```

### 3. Veritabanı

```bash
pnpm exec prisma migrate dev
```

### 4. Python backend

```bash
cd apps/python
python -m venv .venv
# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

İlk YOLOv8 isteğinde `yolov8n.pt` (~6 MB) otomatik iner.

### 5. İki sunucuyu başlat

İki ayrı terminalde:

```bash
# Terminal 1 — Frontend
pnpm dev
# → http://localhost:3000
```

```bash
# Terminal 2 — Python AI
cd apps/python
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
# → http://localhost:8000/health
```

## 📖 Kullanım

1. http://localhost:3000 → **Video Analizi** → **Video Yükle**
2. 5-10 dakikalık bir maç highlight'ı seç (sabit kameralı/tribün üstü en iyi)
3. **Yüklemeyi Başlat** → progress bar → analiz tamamlanır
4. **Sonuçlara git** → `/video/[id]` sayfasında:
   - Frame-bazlı 3x3 bölge ısı haritası (Takım A · B)
   - Oyuncu sayısı / kompaktlık / pres metrikleri
   - Pres yoğunluğu zaman çizgisi
   - AI Koç tavsiyesi (Türkçe)

## 📂 Klasör Yapısı

```
coachvision-ai/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Login (dev: bypass)
│   ├── (dashboard)/
│   │   ├── video/                    # 🎯 Ana modül
│   │   │   ├── page.tsx              # Faz seçimi
│   │   │   ├── upload/page.tsx       # Yükleme
│   │   │   └── [id]/page.tsx         # Sonuç dashboard
│   │   └── ...                       # tactics, squad, ai-coach...
│   └── api/
│       └── video/
│           ├── upload/route.ts
│           └── [id]/complete/route.ts
├── components/
│   ├── video/
│   │   ├── VideoUploader.tsx         # drag & drop + WS progress
│   │   └── AnalysisDashboard.tsx     # frame gezgini + ısı haritası
│   └── ui/                           # shadcn
├── apps/python/                      # Python AI motoru
│   ├── main.py                       # FastAPI + WebSocket
│   ├── routers/                      # /video/process, /analysis
│   ├── services/
│   │   ├── video_processor.py        # Pipeline orkestrası
│   │   ├── player_detector.py        # YOLOv8
│   │   ├── pitch_detector.py         # HSV yeşil maske
│   │   ├── team_classifier.py        # K-means
│   │   └── zone_analyzer.py          # Bölge + kompaktlık + pres
│   └── ai/                           # Claude wrapper + prompts
├── prisma/
│   ├── schema.prisma                 # Club, Team, Player, Match, MatchVideo, Analysis...
│   └── migrations/
├── lib/                              # auth, db, ai, stores
└── uploads/                          # Yüklenen videolar (gitignore)
```

## 🗺️ Yol Haritası

- **Faz 1 (şimdi):** Video upload → AI analiz ✅
- **Faz 2 (~2 ay):** Screen capture → TV/bilgisayar ekranını canlı oku
- **Faz 3 (~4-6 ay):** Gerçek kamera → sahada canlı analiz

Detay: [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md)

## 🧑‍💻 Geliştirme Kuralları

Kod yazım kuralları, video pipeline kısıtları ve güvenlik standartları için: [`CLAUDE.md`](CLAUDE.md)

Özet:
- TypeScript strict, `any` yok
- Server Component default, `'use client'` sadece gerekirse
- Video işleme **sadece** Python tarafında (Node.js'te FFmpeg/OpenCV yok)
- Yorumlar Türkçe, kod İngilizce
- API key kod içinde **asla**, sadece `.env.local`

## ⚠️ Notlar

- Geliştirme modunda auth bypass aktif. Üretime geçerken `lib/auth/auth.ts`'deki `authorize()` ve `app/(dashboard)/layout.tsx`'teki session kontrolü geri eklenmeli.
- SQLite dev içindir. Üretimde `prisma/schema.prisma` → `provider = "postgresql"` ve `Json` alanları için Postgres avantajı.
- `ANTHROPIC_API_KEY` boşsa pipeline çalışır ama AI Koç tavsiyesi üretilmez.

## 📄 Lisans

Henüz tanımlanmadı.
