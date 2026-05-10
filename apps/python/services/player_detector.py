"""YOLOv8 oyuncu tespiti.

Sadece `person` (class 0) sınıfını tutar, güven 0.6 altını eler.
Model lazy yüklenir, ilk istekte indirilir.
"""
from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Optional

import numpy as np
from ultralytics import YOLO

CONF_THRESHOLD = 0.6
PERSON_CLASS = 0

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


def _get_model() -> YOLO:
    """Modeli ilk kullanımda yükle."""
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                # yolov8n.pt ilk kullanımda otomatik indirilir (~6 MB)
                _model = YOLO("yolov8n.pt")
    return _model


def detect_players(frame: np.ndarray) -> list[Detection]:
    """Bir BGR frame'de oyuncuları tespit et."""
    model = _get_model()
    results = model.predict(frame, verbose=False, conf=CONF_THRESHOLD, classes=[PERSON_CLASS])
    detections: list[Detection] = []
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            xyxy = box.xyxy[0].cpu().numpy()
            conf = float(box.conf[0].cpu().numpy())
            detections.append(
                Detection(
                    x1=float(xyxy[0]),
                    y1=float(xyxy[1]),
                    x2=float(xyxy[2]),
                    y2=float(xyxy[3]),
                    confidence=conf,
                )
            )
    return detections
