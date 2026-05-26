"""Saha kalibrasyonu doğrulama endpoint'i.

Tarayıcı kullanıcının tıkladığı 4 referans noktayı buraya gönderir;
`PitchCalibrator.__post_init__` homografi hesaplar ve geçersiz girdiyi
(collinear, dejenere) reddeder. Başarılıysa Next.js plan kaydına yazılır.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from services.pitch_calibrator import (
    DEFAULT_PITCH_LENGTH_M,
    DEFAULT_PITCH_WIDTH_M,
    PitchCalibrator,
    default_world_corners,
)

router = APIRouter()


class CalibrationValidateRequest(BaseModel):
    image_points: list[list[float]] = Field(
        ..., min_length=4, max_length=4,
        description="Sahanın 4 referans noktasının piksel koordinatı (TL, TR, BR, BL)",
    )
    world_points: list[list[float]] | None = Field(
        default=None,
        description="Metre cinsinden hedef noktalar; verilmezse UEFA saha köşeleri",
    )
    length_m: float = DEFAULT_PITCH_LENGTH_M
    width_m: float = DEFAULT_PITCH_WIDTH_M


class CalibrationValidateResponse(BaseModel):
    ok: bool
    error: str | None = None
    # Sağlıklı homografi'de iki üst köşe arası mesafe ~length_m olmalı —
    # büyük sapma collinear/yanlış sıralama göstergesi
    sample_distance_m: float | None = None


@router.post("/validate", response_model=CalibrationValidateResponse)
async def validate_calibration(req: CalibrationValidateRequest) -> CalibrationValidateResponse:
    try:
        world = req.world_points
        if world is None:
            world = [list(p) for p in default_world_corners(req.length_m, req.width_m)]
        # PitchCalibrator __post_init__ findHomography çağırır, fail ise raise
        calib = PitchCalibrator(
            image_points=[tuple(p) for p in req.image_points],
            world_points=[tuple(p) for p in world],
            length_m=req.length_m,
            width_m=req.width_m,
        )
        # Tutarlılık kontrolü: TL↔TR arası gerçek mesafe ~length_m olmalı
        tl, tr = req.image_points[0], req.image_points[1]
        dist = calib.distance_m(tuple(tl), tuple(tr))
        return CalibrationValidateResponse(ok=True, sample_distance_m=round(dist, 1))
    except ValueError as exc:
        return CalibrationValidateResponse(ok=False, error=str(exc))
    except Exception as exc:  # noqa: BLE001
        return CalibrationValidateResponse(ok=False, error=f"Beklenmeyen hata: {exc}")
