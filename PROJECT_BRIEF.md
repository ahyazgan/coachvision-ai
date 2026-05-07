# CoachVision AI — Profesyonel Futbol Antrenör Asistanı

## 🎯 PROJE VİZYONU

CoachVision AI, futbol antrenörlerinin maç öncesi, sırası ve sonrasında yapay zeka destekli kararlar almasını sağlayan **profesyonel bir koçluk platformudur**. Kamera ile sahayı izler, gerçek zamanlı oyuncu takibi yapar, taktiksel öneriler sunar, sakatlık riski tahmin eder ve antrenörün dijital yardımcısı gibi davranır.

**Hedef Pazar:**
- Türkiye Süper Lig altı ligler (1. Lig, 2. Lig, 3. Lig, BAL)
- TFF akademileri ve U-takımları
- Spor üniversiteleri (eğitim aracı)
- Balkan ve Orta Asya kulüpleri (uluslararası genişleme)

**Rekabet Avantajı:** Wyscout, Hudl, Veo, Alai gibi sistemlere göre **Türkçe**, **canlı analiz**, **hepsi-bir-arada** ve **uygun fiyat**.

---

## 🏗️ TEKNOLOJİ YIĞINI

### Frontend
- **Framework:** Next.js 14 (App Router) + TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **State:** Zustand
- **Animasyon:** Framer Motion
- **Charts:** Recharts + D3.js
- **Saha Görseli:** SVG + Canvas API
- **Form:** React Hook Form + Zod

### Backend
- **API:** Next.js API Routes (başlangıç) → Daha sonra ayrı NestJS sunucu
- **Veritabanı:** PostgreSQL + Prisma ORM
- **Cache:** Redis (Upstash, ücretsiz)
- **Auth:** NextAuth.js (Google, Email)
- **File Storage:** Yerel disk (başlangıç) → S3/Cloudflare R2 (üretim)

### AI / ML
- **Ana LLM:** Claude API (Anthropic) — Sonnet ve Opus
- **Görüntü İşleme (Tarayıcı):** TensorFlow.js + COCO-SSD (insan tespiti)
- **Pose Detection:** MediaPipe Pose
- **OCR (Forma Numarası):** Tesseract.js
- **Top Takibi:** Custom YOLOv8 modeli (Python backend, sonra)
- **Ses → Yazı:** Web Speech API + OpenAI Whisper (yedek)
- **Yazı → Ses:** ElevenLabs API (Türkçe sesli antrenör)

### DevOps
- **Versiyon:** Git + GitHub
- **Deploy (Geliştirme):** Local
- **Deploy (Üretim sonra):** Vercel (frontend) + Railway/Fly.io (backend)
- **Test:** Vitest + Playwright
- **Paket Yöneticisi:** pnpm

---

## 📁 KLASÖR YAPISI

```
coachvision-ai/
├── app/
│   ├── (auth)/                 # Giriş/kayıt sayfaları
│   ├── (dashboard)/            # Ana panel
│   │   ├── live/               # Canlı maç modu
│   │   ├── tactics/            # Taktik tahtası
│   │   ├── squad/              # Kadro yönetimi
│   │   ├── analysis/           # Maç analizi
│   │   ├── training/           # Antrenman planı
│   │   ├── opponent/           # Rakip analizi
│   │   ├── scout/              # Scout modülü
│   │   ├── health/             # Sağlık & sakatlık
│   │   ├── ai-coach/           # AI sohbet
│   │   └── admin/              # Yönetim paneli
│   ├── api/                    # Backend API routes
│   │   ├── ai/                 # Claude API endpoints
│   │   ├── matches/
│   │   ├── players/
│   │   └── tracking/
│   └── layout.tsx
├── components/
│   ├── ui/                     # shadcn bileşenleri
│   ├── pitch/                  # Saha görselleri (SVG)
│   ├── camera/                 # Kamera & tracking
│   ├── charts/                 # Grafikler
│   ├── ai/                     # AI sohbet bileşenleri
│   └── shared/
├── lib/
│   ├── ai/                     # Claude API helpers
│   │   ├── claude.ts
│   │   ├── prompts.ts
│   │   └── context.ts
│   ├── tracking/               # TF.js + MediaPipe
│   │   ├── detection.ts
│   │   ├── calibration.ts
│   │   └── stats.ts
│   ├── db/                     # Prisma client
│   │   └── client.ts
│   └── utils/
├── prisma/
│   └── schema.prisma
├── public/
├── styles/
├── docs/                       # Dokümantasyon
├── scripts/                    # Yardımcı scriptler
├── .env.example
├── CLAUDE.md                   # Claude Code kuralları
├── PROJECT_BRIEF.md            # Bu dosya
├── package.json
└── README.md
```

---

## 🎨 TASARIM SİSTEMİ

### Renk Paleti
```css
--bg-primary: #070b12        /* Koyu lacivert arka plan */
--bg-surface: #0d1422        /* Panel arka plan */
--bg-card: #111827           /* Kart arka plan */
--border: #1e2d45            /* Kenarlık */
--accent-primary: #00e5ff    /* Cyan vurgu */
--accent-danger: #ff4d6d     /* Kırmızı (uyarı, rakip) */
--accent-success: #39ff14    /* Yeşil (canlı, başarı) */
--accent-warning: #ffd700    /* Altın (kart, dikkat) */
--text-primary: #e2eaf5      /* Ana metin */
--text-muted: #5a7a9a        /* Soluk metin */
```

### Tipografi
- **Başlıklar:** Rajdhani (700/600) — Spor temalı, geniş
- **Body:** Exo 2 (300/400/600) — Modern, okunabilir
- **Mono:** IBM Plex Mono — İstatistik, koordinat
- **Vurgu:** Barlow Condensed — Skor, sayı

### Tasarım Felsefesi
- **Koyu tema öncelikli** (saha kenarında ekran parlamaması için)
- **Yüksek kontrast** (güneşte de okunsun)
- **Bilgi yoğun** ama dağınık değil
- **Askeri/taktik estetik** (NATO HUD tarzı)
- **Animasyon az ama anlamlı**
- **Mobil-first** (telefon ve tablette mükemmel)
- **Dokunmatik öncelikli** (44x44px minimum buton)

---

## ⚠️ DİKKAT EDİLECEKLER

1. **Veri gizliliği:** KVKK ve GDPR uyumlu ol, oyuncu sağlık verisi hassas
2. **Performans:** Mobilde de 60 FPS çalışsın
3. **Offline mod:** Saha kenarında internet kesilirse devam etsin (Service Worker)
4. **Türkçe öncelik:** Tüm UI Türkçe, sonra İngilizce
5. **Hata yönetimi:** AI cevap vermezse fallback olsun
6. **Maliyet:** Claude API kullanımını izle, kullanıcı başına kota
7. **Erişilebilirlik:** Renk körlüğü modu, klavye kısayolları
8. **Test:** Kritik akışlar için E2E test (Playwright)
9. **Backup:** Veritabanı günlük yedek
10. **Loglama:** Sentry veya benzeri error tracking

---

(Tam vizyon, modüller listesi ve veritabanı şeması için orijinal PROJECT_BRIEF.md'ye bakılmalıdır — ana içerik prisma/schema.prisma içine yansıtılmıştır.)
