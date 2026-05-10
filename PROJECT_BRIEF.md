# CoachVision AI — Profesyonel Futbol Antrenör Asistanı

## 🎯 PROJE VİZYONU

CoachVision AI, futbol antrenörlerinin maç videolarını yapay zeka ile analiz eden, taktik tavsiye veren profesyonel bir koçluk platformudur.

**Ana Yaklaşım — 3 Faz:**
1. **Faz 1 (Şimdi):** Video dosyası yükle → AI analiz et (MP4, kayıt, highlight)
2. **Faz 2 (2 ay):** Screen capture → TV/bilgisayar ekranını canlı oku
3. **Faz 3 (4-6 ay):** Gerçek kamera → sahada canlı analiz

**Neden bu sıra?**
- Sahaya gitmeden her maçı analiz edebilirsin
- TV yayını zaten profesyonel açıdan çekiyor (tribünden daha iyi)
- Dünya'daki her maçı analiz edebilirsin (rakip dahil)
- Hemen başlanabilir, donanım gerekmez

**Hedef Pazar:**
- Türkiye 1. Lig, 2. Lig, 3. Lig, BAL kulüpleri
- TFF akademileri ve U-takımları
- Spor üniversiteleri
- Balkan ve Orta Asya kulüpleri

**İş Modeli:** SaaS abonelik
- Amatör: 2.500 TL/ay
- Profesyonel: 9.500 TL/ay
- Kulüp: 25.000 TL/ay

---

## 🏗️ TEKNOLOJİ YIĞINI

### Frontend
- **Framework:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **State:** Zustand
- **Charts:** Recharts + D3.js
- **Video:** HTML5 Video + Canvas API (overlay için)
- **Form:** React Hook Form + Zod
- **Real-time:** WebSocket (analiz progress için)

### Backend — İki Katman

**Node.js (Next.js API Routes):**
- Auth, kullanıcı yönetimi
- Veritabanı işlemleri
- Python backend ile köprü

**Python (FastAPI) — Ana AI Motoru:**
- Video işleme (OpenCV + FFmpeg)
- YOLOv8 oyuncu tespiti
- Saha kalibrasyonu
- Takım ayrımı
- Taktik analiz hesaplamaları
- Claude API entegrasyonu

### AI / ML Araçları
- **Ana LLM:** Claude API (claude-sonnet-4-20250514)
- **Oyuncu Tespiti:** YOLOv8 (ultralytics) — yolov8n.pt (hızlı)
- **Video İşleme:** OpenCV + FFmpeg
- **Saha Tespiti:** OpenCV renk segmentasyonu
- **Takım Ayrımı:** K-means kümeleme (forma rengi)
- **Screen Capture:** Python mss (Faz 2)
- **Ses Analizi:** OpenAI Whisper (komentator metni)
- **Sesli Yanıt:** ElevenLabs (Türkçe)

### Video İşleme Pipeline
```
Video Girişi (MP4 / Screen Capture / Kamera)
         ↓
FFmpeg → Frame çıkar (her 2 saniyede 1)
         ↓
YOLOv8 → Her frame'de oyuncu tespit et
         ↓
OpenCV → Saha sınırlarını bul (yeşil alan)
         ↓
K-means → Takımları ayır (forma rengi)
         ↓
Analiz → Bölge, kompaktlık, pres, ısı haritası
         ↓
Claude API → Taktik yorum + tavsiye
         ↓
Frontend → Görsel rapor + sesli uyarı
```

---

## 📁 KLASÖR YAPISI

```
coachvision-ai/
├── app/                              # Next.js frontend (mevcut)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                # Sidebar + header
│   │   ├── page.tsx                  # Ana dashboard
│   │   ├── video/                    # 🎯 ANA MODÜL
│   │   │   ├── upload/               # Video yükleme
│   │   │   ├── screen/               # Screen capture (Faz 2)
│   │   │   ├── live/                 # Canlı kamera (Faz 3)
│   │   │   └── [id]/                 # Analiz sonuçları
│   │   ├── tactics/                  # Taktik tahtası
│   │   ├── squad/                    # Kadro
│   │   ├── matches/                  # Maçlar
│   │   ├── opponent/                 # Rakip analizi
│   │   ├── health/                   # Sağlık
│   │   ├── ai-coach/                 # AI sohbet
│   │   └── reports/                  # Raporlar
│   └── api/
│       ├── video/route.ts            # Video upload endpoint
│       ├── analysis/route.ts
│       ├── ai/route.ts
│       └── auth/
├── components/
│   ├── video/
│   │   ├── VideoUploader.tsx         # Drag & drop
│   │   ├── VideoPlayer.tsx           # HTML5 player
│   │   ├── VideoOverlay.tsx          # Canvas üstü çizimler
│   │   └── AnalysisPanel.tsx         # AI tavsiye paneli
│   ├── pitch/
│   │   ├── PitchSVG.tsx              # Saha çizimi
│   │   ├── HeatMap.tsx               # Isı haritası
│   │   └── ZoneMap.tsx               # Bölge haritası
│   └── ui/                           # shadcn bileşenleri
│
├── apps/
│   └── python/                       # Python AI backend
│       ├── main.py                   # FastAPI server
│       ├── routers/
│       │   ├── video.py              # Video işleme routes
│       │   └── analysis.py           # Analiz routes
│       ├── services/
│       │   ├── video_processor.py    # Ana video işleyici
│       │   ├── player_detector.py    # YOLOv8 entegrasyonu
│       │   ├── pitch_detector.py     # Saha tespiti
│       │   ├── team_classifier.py    # Takım ayrımı
│       │   ├── zone_analyzer.py      # Bölgesel analiz
│       │   ├── compactness.py        # Kompaktlık hesabı
│       │   ├── pressure.py           # Pres yoğunluğu
│       │   └── heatmap.py            # Isı haritası
│       ├── ai/
│       │   ├── claude_client.py      # Claude API
│       │   └── prompts.py            # Prompt şablonları
│       └── requirements.txt
│
├── prisma/
│   └── schema.prisma
├── uploads/                          # Video dosyaları (gitignore)
│   ├── videos/
│   └── frames/
├── .env.example
├── CLAUDE.md
├── PROJECT_BRIEF.md
└── README.md
```

---

## 🗄️ VERİTABANI ŞEMASI (özet)

Pivotla eklenen ana tablolar:

```prisma
// 🎯 ANA TABLO
model MatchVideo {
  id         String     @id @default(cuid())
  matchId    String
  filePath   String     // Sunucudaki yol
  fileName   String     // Orijinal dosya adı
  fileSize   Int        // Byte
  duration   Int?       // Saniye
  source     String     // upload | screen_capture | camera
  status     String     // uploading | processing | done | error
  progress   Int        @default(0) // 0-100
  frameCount Int?       // İşlenen toplam frame
  match      Match      @relation(fields: [matchId], references: [id])
  analyses   Analysis[]
  createdAt  DateTime   @default(now())
}

model Analysis {
  id            String      @id @default(cuid())
  matchId       String
  videoId       String?
  minute        Int         // Maçın kaçıncı dakikası
  frameNumber   Int?        // Video'nun kaçıncı frame'i
  timestamp     Float?      // Video'daki saniye

  // Oyuncu tespiti
  playerCountA  Int
  playerCountB  Int
  confidence    Float       // 0-1

  // Bölgesel analiz (3x3 grid)
  zonesA        Json
  zonesB        Json

  // Kompaktlık (metre)
  compactnessA  Float
  compactnessB  Float

  // Pres (0-100)
  pressureScore Float

  // Isı haritası
  heatmapA      Json?
  heatmapB      Json?

  // AI yorumu
  aiAdvice      String?
  riskLevel     String?     // low | medium | high | critical
  opportunity   String?

  match         Match       @relation(fields: [matchId], references: [id])
  video         MatchVideo? @relation(fields: [videoId], references: [id])
  createdAt     DateTime    @default(now())

  @@index([matchId, minute])
  @@index([videoId, frameNumber])
}
```

Mevcut `Club`, `Team`, `Player`, `Match`, `User` tabloları korunur.

---

## 🔐 ÇEVRE DEĞİŞKENLERİ (.env.example)

```env
# Veritabanı
DATABASE_URL="postgresql://postgres:password@localhost:5432/coachvision"

# Auth
NEXTAUTH_SECRET="rastgele-bir-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI
ANTHROPIC_API_KEY="sk-ant-..."

# Python Backend
PYTHON_API_URL="http://localhost:8000"

# Video Ayarları
MAX_VIDEO_SIZE_MB=2000
VIDEO_UPLOAD_DIR="./uploads/videos"
FRAME_EXTRACT_DIR="./uploads/frames"
FRAME_INTERVAL_SECONDS=2

# Opsiyonel (sonra eklenecek)
ELEVENLABS_API_KEY=""
OPENAI_API_KEY=""
```

---

## 🎯 MVP GELİŞTİRME SIRASI (4 Hafta)

### Hafta 1: Kurulum + Video Yükleme
1. Next.js + TypeScript + Tailwind + shadcn/ui (mevcut)
2. Python FastAPI kurulumu
3. PostgreSQL + Prisma — `MatchVideo` + `Analysis` tabloları
4. NextAuth ile giriş sistemi (mevcut)
5. Sidebar + layout (mevcut)
6. Video yükleme sayfası: drag & drop, progress bar, format kontrolü (mp4/mov/avi/mkv), max 2GB, önizleme

**Test:** Video yükleyip görebilmek

### Hafta 2: Python AI — Oyuncu Tespiti
1. FastAPI server kurulumu
2. FFmpeg entegrasyonu (frame çıkarma)
3. YOLOv8 kurulumu ve test
4. Saha tespiti (yeşil renk)
5. Takım ayrımı (K-means)
6. WebSocket ile progress frontend'e iletme

**requirements.txt:**
```
fastapi==0.104.1
uvicorn==0.24.0
opencv-python==4.8.1.78
ultralytics==8.0.196
numpy==1.24.3
scikit-learn==1.3.2
mss==9.0.1
ffmpeg-python==0.2.0
anthropic==0.7.0
python-multipart==0.0.6
websockets==12.0
Pillow==10.1.0
```

**Test:** Video yükle → frame'lerde oyuncular kutucuk içinde görünsün

### Hafta 3: Taktik Analiz + Claude
1. Bölgesel analiz (9 bölge, 3x3)
2. Kompaktlık hesabı
3. Pres yoğunluğu hesabı
4. Isı haritası verisi
5. Claude API entegrasyonu
6. Taktik prompt şablonları (Türkçe)
7. Sonuçları DB'ye kaydetme

**Test:** Video analizi tamamlandığında ekranda anlamlı taktik yorum görünmeli

### Hafta 4: UI + Rapor + Demo
1. Video player + canvas overlay (oyuncu kutucukları)
2. Isı haritası görselleştirme
3. Bölge haritası
4. AI tavsiye paneli (sağda)
5. Maç sonu PDF raporu
6. Dashboard istatistikleri
7. Demo videosu hazırlığı

**Test:** Galatasaray maçı yükle → rapor çıkar → PDF indir

---

## 🎨 TASARIM SİSTEMİ

```css
--bg-primary: #070b12;      /* Koyu lacivert */
--bg-surface: #0d1422;      /* Panel */
--bg-card: #111827;         /* Kart */
--border: #1e2d45;          /* Kenarlık */
--accent: #00e5ff;          /* Cyan (ana vurgu) */
--danger: #ff4d6d;          /* Kırmızı (risk) */
--success: #39ff14;         /* Yeşil (canlı, iyi) */
--warning: #ffd700;         /* Altın (dikkat) */
--text: #e2eaf5;            /* Ana metin */
--muted: #5a7a9a;           /* Soluk metin */
```

**Prensipler:**
- Koyu tema (saha kenarında ekran parlamaması için)
- Yüksek kontrast (güneşte okunabilir)
- Dokunmatik öncelik (tablet kullanımı — min 44x44px buton)
- Tipografi: Rajdhani (başlık) + Exo 2 (body) + IBM Plex Mono (sayı)

---

## ⚠️ ÖNEMLİ KURALLAR

1. **Video işleme Python'da** — Node.js video işleme için zayıf, Python kullan
2. **YOLOv8 nano model** — yolov8n.pt (hızlı ve hafif, başlangıç için yeterli)
3. **Frame sayısı az tut** — her 2 saniyede 1 frame (performans için)
4. **WebSocket progress** — uzun işlemlerde kullanıcı bekleme ekranı görsün
5. **Hata yönetimi** — bozuk video, yanlış format → net hata mesajı
6. **Frame temizleme** — işlenen frame'leri analiz sonrası sil (disk dolmasın)
7. **Claude token sınırı** — max 300 token/istek (maliyet kontrolü)
8. **Güven filtresi** — YOLOv8 güven skoru 0.6 altını gösterme
9. **Türkçe öncelik** — tüm UI ve AI yanıtları Türkçe
10. **TypeScript strict** — `any` tipi kullanma

---

## 📊 BAŞARI METRİKLERİ

**4 Hafta (MVP):**
- Video yükle → analiz tamamlanıyor ✓
- Oyuncular tespit ediliyor (%70+ doğruluk) ✓
- Taktik yorum geliyor (Türkçe) ✓
- PDF rapor çıkıyor ✓
- Demo videosu hazır ✓

**2 Ay:** Screen capture (TV analizi), 3 kulüp pilot, ilk gelir
**6 Ay:** Gerçek kamera entegrasyonu, 10+ ödeme yapan kulüp, aylık 100.000 TL+
**1 Yıl:** 50+ kulüp, Süper Lig müşterisi, uluslararası genişleme
