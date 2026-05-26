"""Doğrulama veri seti — frame çıkar + sistem çıktısını üret.

Akış:
- UI bir saniye değeri seçer (örn. 14.5s) ve buraya gönderir
- Python cv2.VideoCapture ile o frame'i okur, YOLO + team classifier çalıştırır
- JPEG base64 + normalize tespitleri döner
- UI bunu canvas'a basar, kullanıcı elle gerçek konumları işaretler
- Karşılaştırma metrikleri Next tarafında hesaplanır (basit nearest-neighbor)

`TeamColorModel` her istekte sıfırdan kurulur — tek frame için bu zayıf bir
ayrım verir ama hızlı. Daha doğru takım etiketi için kullanıcı sample biriktirir.
"""
from __future__ import annotations

import base64
import logging
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.player_detector import detect_players_and_ball
from services.team_classifier import TeamColorModel, classify_with_model

log = logging.getLogger(__name__)

router = APIRouter()

# Proje köküne göre videos klasörü — Next.js upload buraya yazıyor
_VIDEO_ROOT = Path(__file__).resolve().parents[3] / "uploads" / "videos"


class ExtractFrameRequest(BaseModel):
    file_path: str  # Next.js'in MatchVideo.filePath'i (göreceli veya mutlak)
    time_sec: float


class DetectionDto(BaseModel):
    x: float  # Normalize 0..1 (frame width)
    y: float
    team: str | None  # "A" | "B" | None (kaleci/hakem outlier)
    confidence: float


class ExtractFrameResponse(BaseModel):
    image_b64: str  # data:image/jpeg;base64,...
    width: int
    height: int
    detections: list[DetectionDto]


def _resolve_path(file_path: str) -> Path:
    p = Path(file_path)
    if p.is_absolute() and p.exists():
        return p
    # Göreceli geldiyse uploads klasörü altında ara
    candidate = _VIDEO_ROOT / Path(file_path).name
    if candidate.exists():
        return candidate
    # Doğrudan project root altında dene
    candidate2 = Path(__file__).resolve().parents[3] / file_path
    if candidate2.exists():
        return candidate2
    raise FileNotFoundError(f"Video bulunamadı: {file_path}")


@router.post("/extract-frame", response_model=ExtractFrameResponse)
async def extract_frame(req: ExtractFrameRequest) -> ExtractFrameResponse:
    try:
        path = _resolve_path(req.file_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Video açılamadı")
    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        target_frame = int(max(0, req.time_sec) * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
        ok, frame = cap.read()
        if not ok or frame is None:
            raise HTTPException(status_code=400, detail="Frame okunamadı")
    finally:
        cap.release()

    h, w = frame.shape[:2]

    # YOLO + tek-frame K-means takım atama
    players, _ball = detect_players_and_ball(frame)
    model = TeamColorModel()  # boş — feed → try_fit ile bu tek frame öğrenir
    labels, _centers = classify_with_model(frame, players, model)

    dets: list[DetectionDto] = []
    for det, label in zip(players, labels):
        cx, cy = det.center
        # Ayak pikselini (alt orta) kullan — saha düzlemine yakın
        foot_x = (det.x1 + det.x2) / 2.0
        foot_y = det.y2
        team = "A" if label == 0 else "B" if label == 1 else None
        dets.append(
            DetectionDto(
                x=float(foot_x / w),
                y=float(foot_y / h),
                team=team,
                confidence=float(det.confidence),
            )
        )

    ok_enc, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 78])
    if not ok_enc:
        raise HTTPException(status_code=500, detail="JPEG encode başarısız")
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")

    return ExtractFrameResponse(
        image_b64=f"data:image/jpeg;base64,{b64}",
        width=int(w),
        height=int(h),
        detections=dets,
    )
