"""K-means ile takım ayrımı (forma rengi).

Her tespitin bbox merkezindeki dominant rengi alır, K=2 ile kümeler.
İki takımı `A` (daha açık renkli) ve `B` (daha koyu) olarak etiketler.
"""
from __future__ import annotations

import cv2
import numpy as np
from sklearn.cluster import KMeans

from services.player_detector import Detection


def _dominant_color(frame: np.ndarray, det: Detection) -> np.ndarray:
    """Tespit kutusunun üst yarısının ortalama rengini al (forma bölgesi)."""
    x1, y1, x2, y2 = det.crop_box
    # Üst yarı (kafa hariç gövde) — forma bölgesi
    body_y1 = y1 + int((y2 - y1) * 0.15)
    body_y2 = y1 + int((y2 - y1) * 0.55)
    body_x1 = x1 + int((x2 - x1) * 0.2)
    body_x2 = x2 - int((x2 - x1) * 0.2)

    crop = frame[max(0, body_y1):body_y2, max(0, body_x1):body_x2]
    if crop.size == 0:
        return np.array([128, 128, 128], dtype=np.float32)
    return crop.reshape(-1, 3).mean(axis=0).astype(np.float32)


def classify_teams(
    frame: np.ndarray,
    detections: list[Detection],
) -> tuple[list[int], np.ndarray]:
    """Tespitleri 2 takıma ayır.

    Args:
        frame: BGR frame
        detections: oyuncu tespitleri

    Returns:
        (etiketler [0|1], küme merkezleri (2,3))
        Etiket 0 = Takım A (açık renk), 1 = Takım B (koyu renk)
    """
    if len(detections) < 2:
        return [0] * len(detections), np.zeros((2, 3), dtype=np.float32)

    colors = np.array([_dominant_color(frame, d) for d in detections])
    n_clusters = 2 if len(detections) >= 2 else 1
    kmeans = KMeans(n_clusters=n_clusters, n_init=5, random_state=42)
    raw_labels = kmeans.fit_predict(colors)
    centers = kmeans.cluster_centers_

    # En parlak (yüksek toplam BGR) küme = A
    brightness = centers.sum(axis=1)
    bright_label = int(np.argmax(brightness))
    labels = [0 if int(l) == bright_label else 1 for l in raw_labels]

    # A her zaman index 0 olacak şekilde merkezleri sırala
    if bright_label == 1:
        centers = centers[[1, 0]]

    return labels, centers
