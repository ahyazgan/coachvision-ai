"""Canlı kamera akışı endpoint'leri (HTTP).

Akış:
1. Tarayıcı POST /live/start (opsiyonel maç planı) → session_id
2. Her 2 sn'de bir POST /live/frame/{session_id} (multipart JPEG) → metrics + komutlar + olaylar
3. POST /live/stop/{session_id} → oturumu kapatır, final özeti döner

Frame işleme `services.live_session.process_frame` içinde tek noktada;
WebSocket akışı (`routers/live_ws.py`) aynı helper'ı çağırır.
"""
from __future__ import annotations

import uuid

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from services.live_session import (
    process_frame,
    registry,
    serialize_session_summary,
)
from services.match_plan import MatchPlan

router = APIRouter()


class StartRequest(BaseModel):
    # Opsiyonel — verilirse `MatchPlan.from_dict` ile parse edilir,
    # verilmezse default eşiklerle çalışır.
    plan: dict | None = None


class StartResponse(BaseModel):
    session_id: str


class StopResponse(BaseModel):
    session_id: str
    summary: dict


@router.post("/start", response_model=StartResponse)
async def start_session(req: StartRequest | None = None) -> StartResponse:
    """Yeni bir canlı oturum aç. Body opsiyonel; plan gönderilirse oturuma bağlanır."""
    session_id = uuid.uuid4().hex
    session = registry.create(session_id)
    if req is not None and req.plan:
        session.plan = MatchPlan.from_dict(req.plan)
    return StartResponse(session_id=session_id)


@router.post("/frame/{session_id}")
async def push_frame(session_id: str, file: UploadFile = File(...)) -> dict:
    """Tek bir kamera frame'ini işle, metrik + komut + olay + scoreboard döner."""
    session = registry.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")

    blob = await file.read()
    if not blob:
        raise HTTPException(status_code=400, detail="Boş frame")

    arr = np.frombuffer(blob, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Frame çözülemedi")

    return process_frame(session, frame)


@router.post("/stop/{session_id}", response_model=StopResponse)
async def stop_session(session_id: str) -> StopResponse:
    """Oturumu kapat, final özet döner."""
    session = registry.end(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    return StopResponse(session_id=session_id, summary=serialize_session_summary(session))
