"""Bölgesel + kompaktlık + pres analizi.

3x3 grid (9 bölge) üzerinde takım dağılımı, dikey kompaktlık ve pres yoğunluğu.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from services.pitch_detector import PitchBounds
from services.player_detector import Detection

ZONE_NAMES = [
    "top_left", "top_center", "top_right",
    "mid_left", "mid_center", "mid_right",
    "bot_left", "bot_center", "bot_right",
]


@dataclass
class FrameMetrics:
    zones_a: dict[str, int]
    zones_b: dict[str, int]
    compactness_a: float
    compactness_b: float
    pressure_score: float
    heatmap_a: list[list[float]]
    heatmap_b: list[list[float]]


def _empty_zones() -> dict[str, int]:
    return {z: 0 for z in ZONE_NAMES}


def _zone_index(rel_x: float, rel_y: float) -> str:
    """0-1 normalize koordinattan 3x3 bölge adına çevir."""
    col = min(2, int(rel_x * 3))
    row = min(2, int(rel_y * 3))
    return ZONE_NAMES[row * 3 + col]


def compute_metrics(
    detections: list[Detection],
    labels: list[int],
    pitch: PitchBounds | None,
    frame_shape: tuple[int, int],
) -> FrameMetrics:
    """Bir frame için tüm metrikleri hesapla.

    Args:
        detections: tüm oyuncu tespitleri
        labels: 0 (A) veya 1 (B) takım etiketleri
        pitch: saha sınırı (yoksa frame'in tamamı kullanılır)
        frame_shape: (height, width)
    """
    h, w = frame_shape
    if pitch is None:
        pitch = PitchBounds(x=0, y=0, width=w, height=h)

    zones_a = _empty_zones()
    zones_b = _empty_zones()
    centers_a: list[tuple[float, float]] = []
    centers_b: list[tuple[float, float]] = []

    for det, label in zip(detections, labels):
        cx, cy = det.center
        # Saha içinde değilse atla
        if not (pitch.x <= cx <= pitch.x2 and pitch.y <= cy <= pitch.y2):
            continue
        rel_x = (cx - pitch.x) / max(1, pitch.width)
        rel_y = (cy - pitch.y) / max(1, pitch.height)
        zone = _zone_index(rel_x, rel_y)
        if label == 0:
            zones_a[zone] += 1
            centers_a.append((rel_x, rel_y))
        else:
            zones_b[zone] += 1
            centers_b.append((rel_x, rel_y))

    # Dikey kompaktlık: en üst ve en alt oyuncu arası mesafe (saha yüksekliğine oranla)
    # Saha gerçek yüksekliği ~68 metre kabul edilir
    compactness_a = _vertical_spread(centers_a) * 68.0
    compactness_b = _vertical_spread(centers_b) * 68.0

    # Pres: iki takım oyuncuları ne kadar iç içe? Ortalama en yakın rakip mesafesinin tersi.
    pressure_score = _pressure(centers_a, centers_b)

    # Isı haritası: 3x3 grid normalize
    total_a = max(1, sum(zones_a.values()))
    total_b = max(1, sum(zones_b.values()))
    heatmap_a = [[zones_a[ZONE_NAMES[r * 3 + c]] / total_a for c in range(3)] for r in range(3)]
    heatmap_b = [[zones_b[ZONE_NAMES[r * 3 + c]] / total_b for c in range(3)] for r in range(3)]

    return FrameMetrics(
        zones_a=zones_a,
        zones_b=zones_b,
        compactness_a=compactness_a,
        compactness_b=compactness_b,
        pressure_score=pressure_score,
        heatmap_a=heatmap_a,
        heatmap_b=heatmap_b,
    )


def _vertical_spread(centers: list[tuple[float, float]]) -> float:
    if len(centers) < 2:
        return 0.0
    ys = [c[1] for c in centers]
    return max(ys) - min(ys)


def _pressure(a: list[tuple[float, float]], b: list[tuple[float, float]]) -> float:
    """0-100 skala. İki takım ortalama mesafesi ne kadar küçükse pres o kadar yüksek."""
    if not a or not b:
        return 0.0
    a_arr = np.array(a)
    b_arr = np.array(b)
    # Her A oyuncusunun en yakın B'ye mesafesi
    dists = np.linalg.norm(a_arr[:, None, :] - b_arr[None, :, :], axis=2)
    nearest = dists.min(axis=1)
    avg = float(nearest.mean())
    # 0.0 = üstüste, 0.5 = saha yarısı kadar uzak. Tersini al, 0-100'e ölçekle.
    score = max(0.0, min(100.0, (1.0 - min(1.0, avg / 0.5)) * 100.0))
    return score
