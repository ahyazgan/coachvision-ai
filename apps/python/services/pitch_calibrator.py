"""Saha kalibrasyonu — perspektifi düzelt, piksel→metre dönüştür.

Kullanıcı saha üzerinden 4 referans noktayı tıklar (örn. 4 köşe ya da
çizgi kesişimleri); her noktanın piksel ve metre karşılığı verilir.
`cv2.findHomography` ile dönüşüm matrisi üretilir; sonrasında her piksel
gerçek metre koordinatına çevrilebilir.

Bu kalibre olunca:
- `zone_analyzer.compactness` artık yaklaşık değil, GERÇEK metre.
- `tactical_rules.line_too_open`, `wing_open_*` kuralları güvenilir.
- 3x3 grid'in alanları sahada eşit.

PROMPT.md R1 — projedeki en büyük teknik risk.

Standart saha boyutları: UEFA 105m x 68m (override edilebilir).
"""
from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


DEFAULT_PITCH_LENGTH_M = 105.0
DEFAULT_PITCH_WIDTH_M = 68.0


@dataclass
class PitchCalibrator:
    """Piksel koordinatlarını gerçek saha metresine çeviren homografi.

    Attributes:
        image_points: kullanıcının tıkladığı 4+ piksel noktası
        world_points: aynı noktaların metre karşılığı (örn. saha köşeleri)
        length_m, width_m: saha boyutları (UEFA varsayılan)
    """

    image_points: list[tuple[float, float]]
    world_points: list[tuple[float, float]]
    length_m: float = DEFAULT_PITCH_LENGTH_M
    width_m: float = DEFAULT_PITCH_WIDTH_M

    def __post_init__(self) -> None:
        if len(self.image_points) < 4 or len(self.world_points) < 4:
            raise ValueError("Homografi için en az 4 referans nokta gerekir")
        if len(self.image_points) != len(self.world_points):
            raise ValueError("image_points ve world_points aynı uzunlukta olmalı")
        src = np.array(self.image_points, dtype=np.float32)
        dst = np.array(self.world_points, dtype=np.float32)
        # RANSAC: gürültülü tıklamalara karşı dayanıklı
        H, _ = cv2.findHomography(src, dst, method=cv2.RANSAC)
        if H is None:
            raise ValueError("Homografi hesaplanamadı — noktalar collinear olabilir")
        self._H = H.astype(np.float32)
        try:
            self._H_inv = np.linalg.inv(self._H).astype(np.float32)
        except np.linalg.LinAlgError as exc:
            raise ValueError("Homografi tersinir değil") from exc

    def to_meters(self, px: float, py: float) -> tuple[float, float]:
        """Piksel → saha metre koordinatı."""
        pt = np.array([[[px, py]]], dtype=np.float32)
        out = cv2.perspectiveTransform(pt, self._H)
        return float(out[0, 0, 0]), float(out[0, 0, 1])

    def to_pixels(self, mx: float, my: float) -> tuple[float, float]:
        """Saha metre → piksel (overlay çizimi için)."""
        pt = np.array([[[mx, my]]], dtype=np.float32)
        out = cv2.perspectiveTransform(pt, self._H_inv)
        return float(out[0, 0, 0]), float(out[0, 0, 1])

    def distance_m(
        self,
        p1: tuple[float, float],
        p2: tuple[float, float],
    ) -> float:
        """İki PİKSEL noktasının gerçek metre uzaklığı."""
        m1 = self.to_meters(*p1)
        m2 = self.to_meters(*p2)
        return float(np.hypot(m1[0] - m2[0], m1[1] - m2[1]))

    def compactness_m(
        self,
        foot_points: list[tuple[float, float]],
    ) -> float:
        """Bir takımın dikey kompaktlığı (gerçek metre).

        foot_points: oyuncu ayak konumlarının piksel koordinatları.
        Boş veya tek elemanlı listede 0 döner.
        """
        if len(foot_points) < 2:
            return 0.0
        ys_m = [self.to_meters(px, py)[1] for px, py in foot_points]
        return max(ys_m) - min(ys_m)

    def to_dict(self) -> dict:
        return {
            "image_points": [list(p) for p in self.image_points],
            "world_points": [list(p) for p in self.world_points],
            "length_m": self.length_m,
            "width_m": self.width_m,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PitchCalibrator":
        return cls(
            image_points=[tuple(p) for p in data["image_points"]],
            world_points=[tuple(p) for p in data["world_points"]],
            length_m=float(data.get("length_m", DEFAULT_PITCH_LENGTH_M)),
            width_m=float(data.get("width_m", DEFAULT_PITCH_WIDTH_M)),
        )


def default_world_corners(
    length_m: float = DEFAULT_PITCH_LENGTH_M,
    width_m: float = DEFAULT_PITCH_WIDTH_M,
) -> list[tuple[float, float]]:
    """Sahanın 4 köşesinin metre koordinatları (sol-üst orijin, saat yönü).

    UI 4-tık kalibrasyonunda kullanıcıdan saha köşelerini bu sırayla
    tıklaması beklenir:
        1) Sol-üst, 2) Sağ-üst, 3) Sağ-alt, 4) Sol-alt
    """
    return [
        (0.0, 0.0),
        (length_m, 0.0),
        (length_m, width_m),
        (0.0, width_m),
    ]
