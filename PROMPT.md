# CoachVision AI — Claude Code Devam Promptu

> Bu dosya, bir danışma oturumunda alınan tüm kararların özetidir. Amacı:
> projeyi Claude Code ile kaldığın yerden devam ettirmek. Projenin köküne
> koy, Claude Code'a "bu dosyayı oku, sonra X görevini yap" diyebilirsin.

---

## 0. Projenin tek cümlelik özü (EN ÖNEMLİ KARAR)

**Football Manager mantığı:** Teknik direktör maç öncesi planını KENDİSİ
kurgular (diziliş, oyuncu görevleri, takım talimatları). Sistem maç sırasında
kameradan gerçekte ne olduğunu ölçer ve PLANLA KARŞILAŞTIRIR. Plana
uyuluyorsa sessiz kalır; **sapma varsa bildirim gönderir.**

Referans noktası genel futbol mantığı DEĞİL — kullanıcının kendi planıdır.
Bu, projenin diğer her şeyden önce gelen çekirdek felsefesidir.

Canlı maçta kullanıcı HEM ham sayı (pres, kompaktlık, sahiplenme) HEM
taktik komut (sapma uyarısı) ister. İletim: tablete görsel kart + yan
panoya canlı veri (ikisi aynı WebSocket akışından beslenir).

---

## 1. Mevcut sistemin durumu (zaten kodlanmış, korunacak)

Repo: `coachvision-ai` — Next.js (UI + auth + köprü) + Python FastAPI (AI motoru).
~2.000 satır Python + ~4.600 satır TS. Bu çalışan bir mimari, sıfırdan değil.

Doğru kurulmuş ve KORUNACAK olanlar:
- Timestamp tabanlı frame çıkarma (`video_processor.py`) — FPS'e güvenmiyor, doğru.
- YOLOv8 @1280px oyuncu+top tespiti (`player_detector.py`), top için ayrı eşik.
- L*a*b* renk uzayında K-means takım ayrımı (`team_classifier.py`),
  K=3 ile en küçük kümeyi kaleci/hakem outlier sayma.
- 3x3 bölge + metre cinsinden dikey kompaktlık + vektörize pres skoru (`zone_analyzer.py`).
- Top sahipliği + sahiplenme geçişi debounce (`ball_analyzer.py`).
- Video boyu yaşayan tek tracker (`player_tracker.py`).
- AI ayrımı DOĞRU: konum/metrik hesabı kodda, sadece YORUM Claude'a gidiyor
  (`ai/claude_client.py`, `ai/prompts.py`). Maliyet için 5dk segment bazlı yorum.
- Canlı oturum yöneticisi (`live_session.py`), HTTP frame endpoint (`live.py`).
- 19 modelli Prisma şeması — sadece video değil, tam kulüp platformu.

---

## 2. Bu oturumda EKLENEN kod (repoda mevcut olması beklenen)

### `apps/python/services/tactical_rules.py` (YENİ — eklendi)
Taktik kural motoru. Metrikleri taktik komuta çevirir. Saf hesaplama, AI yok.
4 kural: `line_too_open` (savunma açıldı, RİSK), `under_pressure` (sıkıştı,
DİKKAT), `wing_open_left/right` (kanat boş, FIRSAT), `over_crowded` (yığılma,
DİKKAT). Her kuralın 25sn cooldown'u var. Eşikler dosya başında.

### `apps/python/routers/live_ws.py` (YENİ — eklendi)
WebSocket akışı `WS /live/ws/{session_id}`. Her kareyi işleyip metrik +
komut + olay'ı tek JSON mesajıyla ANINDA iter. `frame_result` mesajı.

### `apps/python/main.py` (DEĞİŞTİRİLDİ — 2 satır)
- Import: `from routers import analysis, live, live_ws, video`
- Kayıt: `app.include_router(live_ws.router, prefix="/live", tags=["live-ws"])`

**ÖNEMLİ UYARI:** `tactical_rules.py`'daki kompaktlık eşikleri (38m, 18m)
şu an PİKSEL tabanlı, gerçek metre değil. Bu yüzden kamera açısı değişince
yanlış tetiklenir. Bölüm 3'teki kalibrasyon (R1) çözülmeden bu kurallar
sadece "yaklaşık" çalışır.

---

## 3. KRİTİK TEKNİK RİSKLER (öncelik sırası — bunları çöz)

### R1 — Saha kalibrasyonu yok (EN BÜYÜK RİSK, ÖNCE BU)
Bölge ataması oyuncunun PİKSEL konumunu kullanıyor. Ama kamera perspektifi
sahayı çarpıtıyor: uzaktaki yarı saha yakındakinden küçük görünür, "saha"
trapez şeklinde algılanır. Yani 3x3 bölgen gerçek sahada eşit alanlar DEĞİL,
ve kompaktlık metrikleri gerçek metre değil.
**Çözüm:** Homografi. Saha çizgilerinden 4+ referans noktası → `cv2.findHomography`
+ `cv2.warpPerspective` ile kuşbakışı (top-down) düzleme çevir. Bu yapılınca
TÜM metrikler gerçek metre olur, taktik kuralları güvenilir hale gelir.
**Yeni servis önerisi:** `apps/python/services/pitch_calibrator.py`,
mevcut `pitch_detector.py`'ın üstüne oturur.

### R2 — Takım ayrımı her frame'de bağımsız
`classify_teams` her frame'de sıfırdan K-means yapıyor — label flickering
(A takımı frame'den frame'e küme değiştirebilir). Parlaklık sıralaması
kısmen çözüyor ama benzer formada kırılır.
**Çözüm:** İlk N anlamlı frame'den sabit "takım renk modeli" (Lab centers)
öğren, sonraki frame'lerde yeni K-means yerine sabit merkezlere en yakın atama.

### R3 — Tek kamerada top sahipliği gürültülü
Top sık görünmez (oyuncu arkası, hava blur). Sahiplik metriği gürültülü.
**Çözüm:** Top tespitini zaman içinde yumuşat, kaybolunca son sahipliği koru.

### R4 — Performans
90dk video → 2.700 frame, her birinde YOLOv8@1280 + K-means + (homografi).
CPU'da çok yavaş.
**Çözüm:** GPU (CUDA) şart. GPU yoksa batch inference, 960px, 3sn aralık.
İşlem süresini ölç, kullanıcıya tahmini bekleme göster.

### R5 — Hata dayanıklılığı
`_notify_nextjs`, `_save_preview` hataları sessizce yutuyor (`except: pass`).
**Çözüm:** En azından `logging` ile kaydet.

---

## 4. DOĞRULAMA EKSİĞİ (en önemli orta vadeli iş)

Sistemin "doğru" çalıştığını ölçen HİÇBİR şey yok. PROJECT_BRIEF "%70+
doğruluk" diyor ama bunu kanıtlayan veri yok.
**Yapılacak:** 5-10 dk klibi elle etiketle (gerçek oyuncu konumu + takım).
Sistemin çıktısını bununla kıyasla. Metrikler: tespit precision/recall,
takım ayrım doğruluğu, bölge atama doğruluğu. Bu olmadan müşteriye
"doğru analiz" sözü verilemez.

---

## 5. YAPILACAKLAR — kararlaştırılan sıra

### Çekirdek (ÖNCE — Football Manager mantığı)
1. **Maç planı modülü:** Kullanıcının kurgusunu tutan veri yapısı
   (diziliş, oyuncu görevleri, takım talimatları, eşik değerleri).
   Yeni: `apps/python/services/match_plan.py` + Prisma'da `MatchPlan` modeli.
2. **Sapma kontrol motoru:** Mevcut `tactical_rules.py`'ı SABİT eşikler yerine
   PLANDAN gelen değerlerle karşılaştıracak şekilde değiştir. Eşik artık
   kullanıcının o maç için kurguladığı plandan gelir (örn. "max 30m kompakt").

### Sonra (çekirdek bitince)
3. **Homografi kalibrasyonu (R1)** — orta-grup özelliklerin ön koşulu.
4. **Canlı istatistik paneli + yardımcı antrenör tavsiyesi + olay timeline**
   (FM hissi veren kolay özellikler, kalibrasyona ihtiyaç duymaz).

### Orta grup (kalibrasyon SONRASI)
5. Canlı ısı haritası (zone verisi var, doğru koordinatla)
6. Rakip diziliş tespiti
7. Oyuncu anlık reyting (oyuncu kimlik takibi de gerektirir)

### İleri / sonraya bırakılanlar (donanım veya çok veri ister)
- Maç sonu plan-uyum raporu (sapmaları kaydet, özetle) — değerli, kolay.
- Rakip keşfi (scouting) — planı besler.
- Geri bildirim döngüsü (hangi uyarı işe yaradı) — sistemi akıllandırır.
- Yorgunluk/sakatlık takibi — GPS YELEĞİ ister, tek kamerada güvenilmez.
- Öğrenen sistem — çok maç verisi ister, "1 yıl sonra" işi.

---

## 6. Claude Code çalışma kuralları (bu projede)

- `CLAUDE.md`'yi 60 satırlık omurgaya indir, detayları `.claude/rules/*.md`'ye
  böl: `python-ai.md`, `frontend.md`, `tactics.md` (her birine `paths:` glob).
- Alt-ajanlar: `vision-engineer` (services/, homografi+tracker),
  `tactics-analyst` (zone+kural, read-only), `frontend-dev` (app/, components/).
- Araştırma görevlerini alt-ajana ver (ana bağlamı temiz tut).
- Görü kodunda regresyon kolay — her servise küçük test seti (örnek frame →
  beklenen çıktı). "Görü servisini değiştirince testleri çalıştır" kuralı ekle.
- MCP'leri 10'un altında tut.

---

## 7. Mimari kuralları (değişmez)

1. Video/görü işleme PYTHON'da (Node.js zayıf).
2. Konum/metrik hesabı KODDA, sadece dil/yorum Claude API'da (hız + maliyet).
3. Her katman ayrı: görü (Python services), beyin (kural motoru + AI),
   arayüz (Next.js + WebSocket), veri (PostgreSQL/Prisma).
4. TypeScript strict, `any` yok. Yorumlar Türkçe, kod İngilizce.
5. YOLOv8 güven < 0.6 gösterme. Türkçe öncelik (UI + AI yanıtları).

---

## 8. İlk verilebilecek görev örneği (Claude Code'a)

> "Bu dosyayı (PROMPT.md) ve mevcut `apps/python/services/` klasörünü oku.
> Bölüm 5'teki çekirdek adım 1'i yap: `match_plan.py` servisini oluştur —
> kullanıcının maç planını (diziliş, takım talimatları, kompaktlık/pres eşik
> değerleri) tutan bir veri yapısı. Sonra Prisma şemasına `MatchPlan` modeli
> ekle. tactical_rules.py'ı henüz değiştirme, önce planı kuralım."
