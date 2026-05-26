"""CoachVision AI - Python AI motoru (FastAPI).

Video işleme, oyuncu tespiti ve taktik analiz için ana sunucu.
Next.js backend HTTP üzerinden bu sunucuyu tetikler; ilerleme WebSocket ile döner.
"""
from __future__ import annotations

# Windows konsolu varsayılan cp1252 ile gelir; emoji ve Türkçe karakterler için UTF-8'e zorla.
import sys
import io
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, Set

from dotenv import load_dotenv

# Tek noktada logging yapılandır — PROMPT.md R5. Tüm modüller getLogger
# çağırdığında bu config'e düşer. Ortam değişkeni LOG_LEVEL ile override.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-7s %(name)s : %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("coachvision")

# Proje kökündeki .env.local'i yükle (ANTHROPIC_API_KEY vs.)
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_PROJECT_ROOT / ".env.local")
load_dotenv(_PROJECT_ROOT / ".env", override=False)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from routers import analysis, calibration, live, live_ws, opponent, validation, video


# Aktif WebSocket bağlantıları (video_id -> connections)
_progress_subscribers: Dict[str, Set[WebSocket]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001 — FastAPI imzası gerekli
    # Açılışta cihaz durumu görünür olsun (R4: GPU varsa 1280, yoksa 960).
    try:
        from services.player_detector import get_device_info
        info = get_device_info()
        log.info(
            "Inference cihazı: %s · imgsz=%d · cuda=%s",
            info["device"], info["inference_size"], info["has_cuda"],
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("Cihaz tanılaması yapılamadı: %s", exc)
    yield
    # Kapanışta açık WS'leri temizle
    for conns in _progress_subscribers.values():
        for ws in list(conns):
            try:
                await ws.close()
            except Exception as exc:  # noqa: BLE001
                log.debug("WS close hatası (yoksayıldı): %s", exc)


app = FastAPI(
    title="CoachVision AI - Python Motoru",
    version="0.1.0",
    lifespan=lifespan,
)

# Next.js dev sunucusu CORS izni
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("NEXTJS_ORIGIN", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video.router, prefix="/video", tags=["video"])
app.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
app.include_router(live.router, prefix="/live", tags=["live"])
app.include_router(live_ws.router, prefix="/live", tags=["live-ws"])
app.include_router(calibration.router, prefix="/calibration", tags=["calibration"])
app.include_router(validation.router, prefix="/validation", tags=["validation"])
app.include_router(opponent.router, prefix="/opponent", tags=["opponent"])


@app.get("/health")
async def health() -> dict:
    from services.player_detector import get_device_info
    return {
        "status": "ok",
        "service": "coachvision-python",
        "device": get_device_info(),
    }


@app.websocket("/ws/video/{video_id}")
async def video_progress(ws: WebSocket, video_id: str) -> None:
    """Video işleme ilerlemesini canlı dinle."""
    await ws.accept()
    subs = _progress_subscribers.setdefault(video_id, set())
    subs.add(ws)
    try:
        # Bağlantıyı açık tut; ileride gelen mesajları yok say
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        subs.discard(ws)
        if not subs:
            _progress_subscribers.pop(video_id, None)


async def broadcast_progress(video_id: str, payload: dict) -> None:
    """Pipeline tarafından çağrılır. Tüm aboneye yayar."""
    subs = _progress_subscribers.get(video_id)
    if not subs:
        return
    dead: list[WebSocket] = []
    for ws in subs:
        try:
            await ws.send_json(payload)
        except Exception as exc:  # noqa: BLE001
            log.debug("WS send hatası (abone düşürülüyor): %s", exc)
            dead.append(ws)
    for ws in dead:
        subs.discard(ws)


# Router'lardan erişebilmek için app objesine bağla
app.state.broadcast_progress = broadcast_progress


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )
