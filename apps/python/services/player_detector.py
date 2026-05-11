"""YOLOv8 oyuncu + top tespiti.

`person` (class 0) ve `sports ball` (class 32) sınıflarını tek inference'ta
çıkarır, ayırarak döner. Güven eşikleri sınıfa göre değişir — top küçük
olduğu için daha düşük eşik.
"""
from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Optional

import numpy as np
from ultralytics import YOLO

CONF_THRESHOLD = 0.25  # Düşük tutuldu — futbolda uzaktaki ufak oyuncular için
BALL_CONF_THRESHOLD = 0.20  # Top daha küçük, biraz daha düşük eşik
PERSON_CLASS = 0
BALL_CLASS = 32  # COCO 'sports ball'
# YOLOv8 çıkarım çözünürlüğü. Varsayılan 640; 1280 küçük/uzak hedefleri çok daha iyi yakalar.
INFERENCE_SIZE = 1280
# Bir frame'in "anlamlı" sayılması için minimum oyuncu sayısı
# (Altındakiler kesim/zoom/replay sayılır, DB'ye yazılmaz.)
MIN_PLAYERS_PER_FRAME = 4

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
    """Modeli ilk kullanımda yükle."""
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                # yolov8n.pt ilk kullanımda otomatik indirilir (~6 MB)
                _model = YOLO("yolov8n.pt")
    return _model


def detect_players_and_ball(
    frame: np.ndarray,
) -> tuple[list[Detection], Optional[BallDetection]]:
    """Tek YOLOv8 inference'da oyuncu + top tespiti.

    Top: en yüksek güvenli tek tespit alınır — futbol maçında 2+ top
    görülmesi olası değil, görülürse en güvenilir olanı doğrudur.
    """
    model = _get_model()
    # En düşük eşikle filtreyi geçir, sonra sınıf bazında elemeyi biz yapalım
    results = model.predict(
        frame,
        verbose=False,
        conf=min(CONF_THRESHOLD, BALL_CONF_THRESHOLD),
        classes=[PERSON_CLASS, BALL_CLASS],
        imgsz=INFERENCE_SIZE,
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
