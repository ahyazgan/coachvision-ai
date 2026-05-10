"""Saha tespiti — yeşil alan maskesi.

Frame'deki yeşil pikselleri (saha) bulur; hem sınırlayıcı dikdörtgeni hem de
**genişletilmiş ikili maskeyi** döner. Mask, kameramanları/saha kenarındaki
seyircileri eler — bbox tek başına eleyemiyor.
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

# HSV uzayında yeşil saha aralığı (geniş tutuldu — farklı aydınlatma şartları)
LOWER_GREEN = np.array([35, 35, 25])
UPPER_GREEN = np.array([90, 255, 255])


@dataclass
class PitchInfo:
    """Sahanın bbox'ı + bool maskesi.

    `mask` orijinal frame ile aynı boyutta, sahaya ait piksellerde True.
    Oyuncu ayağının saha-içi mi yoksa kameraman/seyirci mi olduğunu
    bbox'tan daha doğru ayırt etmek için kullanılır.
    """

    x: int
    y: int
    width: int
    height: int
    mask: np.ndarray  # Bool, shape (H, W)

    @property
    def x2(self) -> int:
        return self.x + self.width

    @property
    def y2(self) -> int:
        return self.y + self.height

    def contains(self, px: float, py: float, tolerance: int = 12) -> bool:
        """Belirtilen noktanın yakınında saha pikseli var mı?

        `tolerance`: piksel cinsinden komşuluk yarıçapı. Oyuncunun ayağı
        kenarda olabilir, küçük tampon ile esneklik kazanırız.
        """
        h, w = self.mask.shape
        x = int(round(px))
        y = int(round(py))
        x0 = max(0, x - tolerance)
        x1 = min(w, x + tolerance + 1)
        y0 = max(0, y - tolerance)
        y1 = min(h, y + tolerance + 1)
        if x0 >= x1 or y0 >= y1:
            return False
        return bool(self.mask[y0:y1, x0:x1].any())


def detect_pitch(frame: np.ndarray) -> PitchInfo | None:
    """Frame'deki yeşil sahayı bul, sınırlayıcı dikdörtgen + maskeyi döner."""
    h, w = frame.shape[:2]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    raw_mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)

    # Gürültüyü temizle
    kernel = np.ones((5, 5), np.uint8)
    cleaned = cv2.morphologyEx(raw_mask, cv2.MORPH_OPEN, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel)

    # En büyük yeşil bağlantılı bölgeyi yalıt
    contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    largest = max(contours, key=cv2.contourArea)
    if cv2.contourArea(largest) < (h * w * 0.10):
        # Saha frame'in en az %10'unu kaplamalı
        return None

    # Tek konturdan dolu maske üret
    pitch_mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(pitch_mask, [largest], -1, 255, thickness=cv2.FILLED)

    # Saha çizgilerinin (beyaz) içerideki delikleri kapanır olsun:
    # büyük yapısal eleman ile dilate et — küçük boşluklar dolar.
    pitch_mask = cv2.dilate(pitch_mask, np.ones((9, 9), np.uint8), iterations=1)

    x, y, bw, bh = cv2.boundingRect(largest)
    return PitchInfo(
        x=x,
        y=y,
        width=bw,
        height=bh,
        mask=(pitch_mask > 0),
    )
