"""Saha tespiti — yeşil alan maskesi.

Frame'deki yeşil pikselleri (saha) maskeleyip sınırlayıcı dikdörtgeni döner.
Bu sınır, oyuncu konumlarını saha-içi/dışı ayırmak ve bölge analizi için kullanılır.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

# HSV uzayında yeşil saha aralığı (geniş tutuldu — farklı aydınlatma şartları)
LOWER_GREEN = np.array([35, 40, 40])
UPPER_GREEN = np.array([85, 255, 255])


@dataclass
class PitchBounds:
    x: int
    y: int
    width: int
    height: int

    @property
    def x2(self) -> int:
        return self.x + self.width

    @property
    def y2(self) -> int:
        return self.y + self.height


def detect_pitch(frame: np.ndarray) -> PitchBounds | None:
    """Frame'deki yeşil sahayı bul, sınırlayıcı dikdörtgenini döner."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)

    # Gürültüyü temizle
    kernel = np.ones((5, 5), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    # En büyük yeşil alanı al
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < (frame.shape[0] * frame.shape[1] * 0.1):
        # Saha frame'in en az %10'unu kaplamalı
        return None

    x, y, w, h = cv2.boundingRect(largest)
    return PitchBounds(x=x, y=y, width=w, height=h)
