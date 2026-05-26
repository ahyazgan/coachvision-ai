"""YOLOv8 oyuncu + top tespiti.

`person` (class 0) ve `sports ball` (class 32) sınıflarını tek inference'ta
çıkarır, ayırarak döner. Güven eşikleri sınıfa göre değişir — top küçük
olduğu için daha düşük eşik.

Performans adaptasyonu (PROMPT.md R4):
- CUDA varsa: 1280px inference, daha kaliteli (uzaktaki oyuncuları yakalar)
- CPU'da: 960px, hız + kalite dengesi (1280 CPU'da frame başına 1s+ alır)
- Ortam değişkeni `INFERENCE_SIZE` ile manuel override edilebilir.
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from threading import Lock
from typing import Optional

import numpy as np
from ultralytics import YOLO

log = logging.getLogger(__name__)

CONF_THRESHOLD = 0.25  # Düşük tutuldu — futbolda uzaktaki ufak oyuncular için
BALL_CONF_THRESHOLD = 0.20  # Top daha küçük, biraz daha düşük eşik
PERSON_CLASS = 0
BALL_CLASS = 32  # COCO 'sports ball'
# Bir frame'in "anlamlı" sayılması için minimum oyuncu sayısı
# (Altındakiler kesim/zoom/replay sayılır, DB'ye yazılmaz.)
MIN_PLAYERS_PER_FRAME = 4


def _detect_device() -> tuple[str, bool]:
    """CUDA varsa kullan, yoksa CPU. Ultralytics torch'a köprüler.

    Returns:
        (device_name, has_cuda) — örn. ("cuda:0", True) veya ("cpu", False)
    """
    try:
        import torch
        if torch.cuda.is_available():
            return f"cuda:{torch.cuda.current_device()}", True
    except Exception as exc:  # noqa: BLE001
        log.debug("CUDA tespit edilemedi: %s", exc)
    return "cpu", False


_DEVICE, _HAS_CUDA = _detect_device()

# Adaptif inference çözünürlüğü: GPU varsa 1280, CPU'da 960.
# Ortam değişkeni override eder (manuel ayar için).
_DEFAULT_SIZE = 1280 if _HAS_CUDA else 960
try:
    INFERENCE_SIZE = int(os.getenv("INFERENCE_SIZE") or _DEFAULT_SIZE)
except ValueError:
    INFERENCE_SIZE = _DEFAULT_SIZE

# Inference süresi izleme (her N frame'de bir ortalama logla)
_INFERENCE_LOG_EVERY = 50
_inference_times: list[float] = []

_model: Optional[YOLO] = None
_lock = Lock()


@dataclass
class Detection:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)

    @property
    def crop_box(self) -> tuple[int, int, int, int]:
        return int(self.x1), int(self.y1), int(self.x2), int(self.y2)


@dataclass
class BallDetection:
    """Sports ball tespiti — frame başına en fazla 1 (en yüksek güven)."""
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2, (self.y1 + self.y2) / 2)


def _get_model() -> YOLO:
    """Modeli ilk kullanımda yükle (lazy + thread-safe)."""
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                # yolov8n.pt ilk kullanımda otomatik indirilir (~6 MB)
                log.info(
                    "YOLOv8 yükleniyor: device=%s, imgsz=%d, cuda=%s",
                    _DEVICE, INFERENCE_SIZE, _HAS_CUDA,
                )
                _model = YOLO("yolov8n.pt")
                # Ultralytics modeli ilk inference'ta cihaza taşır — burada
                # da explicit edebiliriz ama predict() içinde device verince yeter.
    return _model


def get_device_info() -> dict:
    """Çalışma zamanı tanı bilgisi — /health veya UI'ya gösterilir."""
    avg_ms = (
        sum(_inference_times) / len(_inference_times) * 1000.0
        if _inference_times else None
    )
    return {
        "device": _DEVICE,
        "has_cuda": _HAS_CUDA,
        "inference_size": INFERENCE_SIZE,
        "samples": len(_inference_times),
        "avg_inference_ms": round(avg_ms, 1) if avg_ms is not None else None,
    }


def detect_players_and_ball(
    frame: np.ndarray,
) -> tuple[list[Detection], Optional[BallDetection]]:
    """Tek YOLOv8 inference'da oyuncu + top tespiti.

    Top: en yüksek güvenli tek tespit alınır — futbol maçında 2+ top
    görülmesi olası değil, görülürse en güvenilir olanı doğrudur.
    """
    model = _get_model()
    # En düşük eşikle filtreyi geçir, sonra sınıf bazında elemeyi biz yapalım
    t0 = time.perf_counter()
    results = model.predict(
        frame,
        verbose=False,
        conf=min(CONF_THRESHOLD, BALL_CONF_THRESHOLD),
        classes=[PERSON_CLASS, BALL_CLASS],
        imgsz=INFERENCE_SIZE,
        device=_DEVICE,
    )
    elapsed = time.perf_counter() - t0
    _inference_times.append(elapsed)
    # Pencere boyutunu sabit tut (son 200 ölçüm)
    if len(_inference_times) > 200:
        del _inference_times[: len(_inference_times) - 200]
    # Periyodik ortalama log
    if len(_inference_times) % _INFERENCE_LOG_EVERY == 0:
        avg = sum(_inference_times) / len(_inference_times) * 1000.0
        log.info(
            "YOLOv8 inference avg=%.1fms son=%.1fms (n=%d, device=%s)",
            avg, elapsed * 1000.0, len(_inference_times), _DEVICE,
        )
    players: list[Detection] = []
    best_ball: Optional[BallDetection] = None
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            cls = int(box.cls[0].cpu().numpy())
            conf = float(box.conf[0].cpu().numpy())
            xyxy = box.xyxy[0].cpu().numpy()
            if cls == PERSON_CLASS and conf >= CONF_THRESHOLD:
                players.append(
                    Detection(
                        x1=float(xyxy[0]),
                        y1=float(xyxy[1]),
                        x2=float(xyxy[2]),
                        y2=float(xyxy[3]),
                        confidence=conf,
                    )
                )
            elif cls == BALL_CLASS and conf >= BALL_CONF_THRESHOLD:
                if best_ball is None or conf > best_ball.confidence:
                    best_ball = BallDetection(
                        x1=float(xyxy[0]),
                        y1=float(xyxy[1]),
                        x2=float(xyxy[2]),
                        y2=float(xyxy[3]),
                        confidence=conf,
                    )
    return players, best_ball


def detect_players(frame: np.ndarray) -> list[Detection]:
    """Geriye dönük uyumluluk: sadece oyuncuları döner."""
    players, _ = detect_players_and_ball(frame)
    return players
