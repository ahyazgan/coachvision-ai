"""Canlı maç için WebSocket frame akışı — gerçek-time push.

`POST /live/start` ile session_id alındıktan sonra tarayıcı bu WebSocket'e
bağlanır ve her frame'i binary (JPEG bytes) olarak iter. Sunucu işler,
sonucu tek JSON mesajıyla ANINDA döndürür — HTTP path'inin polling'i yerine
real-time push. Frame işleme aynı `process_frame` helper'ında.

Mesaj sözleşmesi (Python → Tarayıcı):
- `{"type": "frame_result", ...process_frame(...)}` — başarılı işleme
- `{"type": "error", "message": "..."}` — geçici hata (bağlantı açık kalır)

Bağlantı yaşam döngüsü oturumdan bağımsızdır: WS kapansa bile oturum HTTP
`/live/stop`'a kadar `registry`'de durur.
"""
from __future__ import annotations

import cv2
import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.live_session import process_frame, registry

router = APIRouter()


@router.websocket("/ws/{session_id}")
async def stream_frames(ws: WebSocket, session_id: str) -> None:
    """Tek bir canlı oturum için real-time frame stream."""
    await ws.accept()
    session = registry.get(session_id)
    if session is None:
        await ws.send_json({"type": "error", "message": "Oturum bulunamadı"})
        await ws.close()
        return

    try:
        while True:
            blob = await ws.receive_bytes()
            if not blob:
                continue
            arr = np.frombuffer(blob, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if frame is None:
                await ws.send_json({"type": "error", "message": "Frame çözülemedi"})
                continue
            result = process_frame(session, frame)
            await ws.send_json({"type": "frame_result", **result})
    except WebSocketDisconnect:
        # Normal kapanış — oturum HTTP /live/stop ile sonlandırılır
        return
