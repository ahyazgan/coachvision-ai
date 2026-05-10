"""K-means ile takım ayrımı (forma rengi).

Strateji:
- 3 oyuncu altıysa: ayırma yapma, hepsi A
- 3-7 oyuncu: K=2 küme (klasik)
- 8+ oyuncu: K=3 küme, en küçük kümeyi "outlier" (kaleci/hakem) sayıp at,
  kalan 2 büyük kümeyi takım A/B yap

Forma rengi yerine **L*a*b* renk uzayı** kullanılır — aydınlatma
varyasyonlarına klasik BGR'ye göre daha dayanıklı.
"""
from __future__ import annotations

from collections import Counter

import cv2
import numpy as np
from sklearn.cluster import KMeans

from services.player_detector import Detection

# Outlier kümede sayılacak kişiler (kaleci, hakem, vd.) etiket -1 alır.
OUTLIER_LABEL = -1


def _torso_color(frame: np.ndarray, det: Detection) -> np.ndarray:
    """Tespit kutusunun gövde bölgesinin ortalama L*a*b* rengi.

    L*a*b* uzayı: L=parlaklık, a=yeşil-kırmızı, b=mavi-sarı.
    Forma rengi kümeleme için ışık değişimine BGR'den daha dayanıklı.
    """
    x1, y1, x2, y2 = det.crop_box
    # Gövde: bbox'ın üst orta dilimi (kafa hariç, bel üzerinde)
    body_y1 = y1 + int((y2 - y1) * 0.18)
    body_y2 = y1 + int((y2 - y1) * 0.55)
    body_x1 = x1 + int((x2 - x1) * 0.25)
    body_x2 = x2 - int((x2 - x1) * 0.25)

    body_y1 = max(0, body_y1)
    body_y2 = max(body_y1 + 1, body_y2)
    body_x1 = max(0, body_x1)
    body_x2 = max(body_x1 + 1, body_x2)

    crop = frame[body_y1:body_y2, body_x1:body_x2]
    if crop.size == 0:
        return np.array([128, 128, 128], dtype=np.float32)
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    return lab.reshape(-1, 3).mean(axis=0).astype(np.float32)


def classify_teams(
    frame: np.ndarray,
    detections: list[Detection],
) -> tuple[list[int], np.ndarray]:
    """Tespitleri 2 takıma ayır, kaleci/hakem benzeri outlier'ları işaretle.

    Returns:
        labels: her tespit için 0 (A) / 1 (B) / -1 (outlier - sayma)
        centers: shape (2, 3) — A ve B'nin L*a*b* küme merkezleri (görsel için)
    """
    n = len(detections)
    if n == 0:
        return [], np.zeros((2, 3), dtype=np.float32)

    # Çok az tespit: ayırma yapma
    if n < 3:
        return [0] * n, np.zeros((2, 3), dtype=np.float32)

    colors = np.array([_torso_color(frame, d) for d in detections])

    # Yeterli oyuncu varsa K=3 dene; en küçük küme kaleci/hakem demektir.
    if n >= 8:
        try:
            km = KMeans(n_clusters=3, n_init=10, random_state=42)
            raw = km.fit_predict(colors)
            counts = Counter(int(l) for l in raw)
            # En az üyeli kümeyi at (kaleci/hakem)
            outlier_cluster = min(counts, key=counts.get)
            big_clusters = [c for c in counts if c != outlier_cluster]
            if len(big_clusters) == 2:
                centers_3 = km.cluster_centers_
                # Daha parlak L (lightness) olan = takım A
                a_cluster = max(big_clusters, key=lambda c: centers_3[c][0])
                b_cluster = [c for c in big_clusters if c != a_cluster][0]
                labels = [
                    0 if int(l) == a_cluster
                    else 1 if int(l) == b_cluster
                    else OUTLIER_LABEL
                    for l in raw
                ]
                centers = np.array([centers_3[a_cluster], centers_3[b_cluster]])
                return labels, centers
        except Exception:
            pass  # K=3 başarısız olursa K=2'ye düş

    # K=2 fallback
    km = KMeans(n_clusters=2, n_init=10, random_state=42)
    raw = km.fit_predict(colors)
    centers_2 = km.cluster_centers_
    a_cluster = int(np.argmax(centers_2[:, 0]))  # parlak L = A
    labels = [0 if int(l) == a_cluster else 1 for l in raw]
    centers = (
        centers_2 if a_cluster == 0 else centers_2[[1, 0]]
    )
    return labels, centers
