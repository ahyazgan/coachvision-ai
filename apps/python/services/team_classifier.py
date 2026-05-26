"""K-means ile takım ayrımı (forma rengi).

İki mod var:

1) **`classify_teams`** — her frame'de bağımsız K-means. Batch video pipeline
   bunu kullanır; her frame'i diğerlerinden habersiz işler.

2) **`classify_with_model` + `TeamColorModel`** — oturum-boyu yaşayan sabit
   "takım renk modeli". İlk N renkten öğrenir, sonra her frame için sabit
   merkez ataması yapar — label flickering yok (PROMPT.md R2).
   Live session bunu kullanır.

Forma rengi yerine **L*a*b* renk uzayı** kullanılır — aydınlatma
varyasyonlarına klasik BGR'ye göre daha dayanıklı.
"""
from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass, field

import cv2
import numpy as np
from sklearn.cluster import KMeans

from services.player_detector import Detection

log = logging.getLogger(__name__)

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
        except Exception as exc:  # noqa: BLE001
            log.debug("K=3 sınıflandırması başarısız, K=2'ye düşülüyor: %s", exc)

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


# =============================================================================
# Oturum-boyu sabit takım renk modeli (PROMPT.md R2)
# =============================================================================

# Modeli "öğrendi" saymak için biriktirilen torso rengi sayısı
LEARN_TARGET_SAMPLES = 30

# Atama sırasında EMA güncelleme katsayısı — yavaş drift'e izin verir
EMA_ALPHA = 0.04

# Bir oyuncunun rengi her iki merkeze de bu mesafeden uzaksa outlier sayılır
OUTLIER_DIST_THRESHOLD = 35.0


@dataclass
class TeamColorModel:
    """Oturum boyu yaşayan sabit takım renk merkezleri.

    İlk N (LEARN_TARGET_SAMPLES) torso renginden K-means ile öğrenilir;
    sonraki frame'lerde sabit merkezlere en yakın atama yapılır → label
    flickering yok. Drift için her atama sonrası küçük EMA güncellemesi.

    Atributlar:
        centers: shape (2, 3) Lab uzayı [A, B]. None ise henüz öğrenilmedi.
        pending_colors: öğrenme öncesi biriktirilen renkler.
        learned: False iken her frame K-means'e fallback yapar.
    """

    centers: np.ndarray | None = None
    pending_colors: list[np.ndarray] = field(default_factory=list)

    @property
    def learned(self) -> bool:
        return self.centers is not None

    def feed(self, colors: np.ndarray) -> None:
        """Öğrenme aşamasında renkleri biriktir."""
        if self.learned:
            return
        for c in colors:
            self.pending_colors.append(c.astype(np.float32))

    def try_fit(self) -> bool:
        """Yeterli veri varsa K-means ile sabit merkezleri çıkar.

        K=3 dener (kaleci/hakem outlier'ı atmak için); başarısız olursa K=2.
        Daha parlak L = takım A kuralı korunur.
        """
        if self.learned or len(self.pending_colors) < LEARN_TARGET_SAMPLES:
            return False

        X = np.array(self.pending_colors, dtype=np.float32)
        try:
            if len(X) >= 24:
                km = KMeans(n_clusters=3, n_init=10, random_state=42)
                raw = km.fit_predict(X)
                counts = Counter(int(l) for l in raw)
                outlier = min(counts, key=counts.get)
                big = [c for c in counts if c != outlier]
                if len(big) == 2:
                    cs = km.cluster_centers_
                    a = max(big, key=lambda c: cs[c][0])
                    b = [c for c in big if c != a][0]
                    self.centers = np.array([cs[a], cs[b]], dtype=np.float32)
                    self.pending_colors.clear()
                    return True

            km = KMeans(n_clusters=2, n_init=10, random_state=42)
            km.fit(X)
            cs = km.cluster_centers_
            a = int(np.argmax(cs[:, 0]))
            b = 1 - a
            self.centers = np.array([cs[a], cs[b]], dtype=np.float32)
            self.pending_colors.clear()
            return True
        except Exception as exc:  # noqa: BLE001
            log.warning("TeamColorModel.try_fit başarısız: %s", exc)
            return False

    def assign(self, colors: np.ndarray) -> list[int]:
        """Sabit merkezlere göre etiketle (her iki merkezden uzak → outlier)."""
        if self.centers is None:
            raise RuntimeError("Model henüz öğrenilmedi")
        dists = np.linalg.norm(colors[:, None, :] - self.centers[None, :, :], axis=2)
        nearest = dists.argmin(axis=1)
        min_dists = dists.min(axis=1)
        labels: list[int] = []
        for i in range(len(colors)):
            if min_dists[i] > OUTLIER_DIST_THRESHOLD:
                labels.append(OUTLIER_LABEL)
            else:
                labels.append(int(nearest[i]))
        return labels

    def update_ema(self, colors: np.ndarray, labels: list[int]) -> None:
        """Atanan oyuncuların ortalamasıyla merkezleri yumuşakça güncelle.

        Forma kirlenmesi/aydınlatma değişimine karşı drift toleransı.
        """
        if self.centers is None:
            return
        for team in (0, 1):
            idx = [i for i, l in enumerate(labels) if l == team]
            if not idx:
                continue
            mean = colors[idx].mean(axis=0)
            self.centers[team] = (1 - EMA_ALPHA) * self.centers[team] + EMA_ALPHA * mean


def classify_with_model(
    frame: np.ndarray,
    detections: list[Detection],
    model: TeamColorModel,
) -> tuple[list[int], np.ndarray]:
    """Sabit takım modeli kullanarak sınıflandır.

    Model henüz öğrenmediyse renkleri biriktir + bu frame için `classify_teams`
    fallback'ine düş (eski davranış). Yeterli veri birikince K-means bir kez
    çalışır, sonrasında her frame sabit merkezler ile etiketlenir.
    """
    if not detections:
        return [], np.zeros((2, 3), dtype=np.float32)

    colors = np.array([_torso_color(frame, d) for d in detections], dtype=np.float32)

    if not model.learned:
        model.feed(colors)
        # Yeterli veri biriktiyse hemen merkez çıkar
        model.try_fit()

    if not model.learned:
        # Hâlâ öğrenmediyse: bu frame için klasik K-means
        return classify_teams(frame, detections)

    labels = model.assign(colors)
    model.update_ema(colors, labels)
    # centers her zaman (2, 3) — None değil çünkü yukarıda kontrol ettik
    return labels, model.centers  # type: ignore[return-value]
