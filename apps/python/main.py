"""CoachVision AI - Python AI motoru (FastAPI).

Video işleme, oyuncu tespiti ve taktik analiz için ana sunucu.
Next.js backend HTTP üzerinden bu sunucuyu tetikler; ilerleme WebSocket ile döner.
"""
from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Dict, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from routers import analysis, video


# Aktif WebSocket bağlantıları (video_id -> connections)
_progress_subscribers: Dict[str, Set[WebSocket]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Uygulama açılışı: model yükleme yer tutucusu
    # YOLOv8 modelini ilk istek geldiğinde lazy yüklüyoruz
    yield
    # Kapanışta açık WS'leri temizle
    for conns in _progress_subscribers.values():
        for ws in list(conns):
            try:
                await ws.close()
            except Exception:
                pass


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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "coachvision-python"}


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
        except Exception:
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
