"""Canlı kamera akışı endpoint'leri.

Akış:
1. Tarayıcı POST /live/start → session_id alır
2. Her 2 sn'de bir POST /live/frame/{session_id} (multipart JPEG) → metrics + new_events döner
3. POST /live/stop/{session_id} → oturumu kapatır, final özeti döner
"""
from __future__ import annotations

import uuid

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from services.ball_analyzer import analyze_frame_ball
from services.live_session import (
    maybe_emit_pressure_event,
    registry,
    serialize_event,
    serialize_session_summary,
    update_session_with_ball_info,
)
from services.video_processor import analyze_frame_full

router = APIRouter()


class StartResponse(BaseModel):
    session_id: str


class StopResponse(BaseModel):
    session_id: str
    summary: dict


@router.post("/start", response_model=StartResponse)
async def start_session() -> StartResponse:
    """Yeni bir canlı oturum aç."""
    session_id = uuid.uuid4().hex
    registry.create(session_id)
    return StartResponse(session_id=session_id)


@router.post("/frame/{session_id}")
async def push_frame(session_id: str, file: UploadFile = File(...)) -> dict:
    """Tek bir kamera frame'ini işle, anlık olayları + skorboard'u döner."""
    session = registry.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")

    blob = await file.read()
    if not blob:
        raise HTTPException(status_code=400, detail="Boş frame")

    # JPEG/PNG → BGR numpy
    arr = np.frombuffer(blob, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Frame çözülemedi")

    session.frame_count += 1

    detections, ball, pitch, metrics, labels = analyze_frame_full(frame)
    player_total = sum(metrics.zones_a.values()) + sum(metrics.zones_b.values())

    # Oturum saat-açısından geçen süreyi maç dakikasına eşle.
    # Maç saati 0:00'dan başlar; gerçek dünyada başlatma anından bu yana
    # geçen süre = "maç içi" zaman. Kullanıcı duraklatırsa şimdilik gerçek
    # zaman akar (FM duraklatınca kamerayı da durdurmuş olur → bu mantıklı).
    import time as _t
    elapsed = _t.time() - session.started_at
    match_minute = int(elapsed // 60)

    # Top + sahiplenme
    new_events = []
    if player_total > 0:
        ball_info = analyze_frame_ball(
            ball=ball,
            detections=detections,
            team_labels=labels,
            pitch=pitch,
            frame_shape=frame.shape[:2],
            minute=match_minute,
            timestamp_sec=elapsed,
        )
        new_events.extend(update_session_with_ball_info(session, ball_info))

    # Yüksek pres olayı
    pressure_event = maybe_emit_pressure_event(
        session, metrics.pressure_score, match_minute, elapsed,
    )
    if pressure_event:
        new_events.append(pressure_event)

    return {
        "session_id": session_id,
        "frame_count": session.frame_count,
        "match_minute": match_minute,
        "metrics": {
            "player_count_a": sum(metrics.zones_a.values()),
            "player_count_b": sum(metrics.zones_b.values()),
            "compactness_a": round(metrics.compactness_a, 1),
            "compactness_b": round(metrics.compactness_b, 1),
            "pressure_score": round(metrics.pressure_score, 1),
            "outlier_count": metrics.outlier_count,
        },
        "ball_detected": ball is not None,
        "new_events": [serialize_event(ev) for ev in new_events],
        "scoreboard": serialize_session_summary(session),
    }


@router.post("/stop/{session_id}", response_model=StopResponse)
async def stop_session(session_id: str) -> StopResponse:
    """Oturumu kapat, final özet döner."""
    session = registry.end(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")
    return StopResponse(session_id=session_id, summary=serialize_session_summary(session))
