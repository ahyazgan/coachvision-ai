# CoachVision AI - Python Motoru

FastAPI tabanlı video işleme ve AI analiz sunucusu.

## Kurulum

```bash
cd apps/python
python -m venv .venv
# Windows
.venv\Scripts\activate
# Mac/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

## Çalıştır

```bash
uvicorn main:app --reload --port 8000
```

Sağlık kontrolü: http://localhost:8000/health

## API

- `POST /video/process` — Video işleme job'u başlat
- `WS /ws/video/{video_id}` — İlerleme yayını
- `GET /health` — Servis kontrolü

## Yapılacaklar

- Hafta 2: FFmpeg + YOLOv8 + saha tespiti + K-means takım ayrımı
- Hafta 3: Bölgesel/kompaktlık/pres analizi + Claude entegrasyonu
- Hafta 4: PDF rapor verisi
