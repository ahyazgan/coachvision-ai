"""Frame'ler arası oyuncu eşleştirme (lightweight tracker).

Pipeline 2 saniyede bir frame örneklediği için klasik IoU tabanlı ByteTrack
güvenilir çalışmıyor — bu aralıkta oyuncular bbox'ları bindiremeyecek kadar
ilerliyor. Bunun yerine: **merkez Öklid mesafesi + boyut benzerliği** ile
Hungarian eşleştirme yapıyoruz. Eşik aşılırsa yeni track açılır,
N frame eşleşmeyen track'lar düşürülür.

Bu, koşu mesafesi/aktif süre çıkarımı için "yeterli iyi" — saatte 1-2 km
sapma olsa da hangi oyuncunun aktif olduğunu yakalar. Daha yüksek doğruluk
için frame örnekleme sıklığını artırmak gerekir.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from scipy.optimize import linear_sum_assignment

from services.player_detector import Detection

# Eşleşme için izin verilen maks merkez mesafesi (piksel). 1080p tactical
# çekimde oyuncu 2 sn'de tipik 60-120 px ilerler — eşik bunun ~1.5 katı.
MAX_MATCH_DISTANCE_PX = 180.0
# Boyut farkı bu eşiği geçerse eşleştirme yapma (büyük yakın oyuncu vs uzak küçük)
MAX_SIZE_RATIO = 2.2
# Bir track eşleşmezse N frame sonra unutulur
MAX_LOST_FRAMES = 3
# Bir track "stabil" sayılması için minimum frame sayısı
MIN_STABLE_FRAMES = 3


@dataclass
class TrackSample:
    """Bir track'in tek bir frame'deki kaydı."""
    frame_idx: int
    timestamp_sec: float
    cx: float
    cy: float
    width: float
    height: float
    team: int  # 0/1/-1 — KMeans etiketi
    confidence: float


@dataclass
class PlayerTrack:
    """Frame'ler arası tutarlı bir oyuncu izi."""
    id: int
    samples: list[TrackSample] = field(default_factory=list)
    lost_frames: int = 0

    @property
    def last(self) -> TrackSample:
        return self.samples[-1]

    @property
    def stable(self) -> bool:
        return len(self.samples) >= MIN_STABLE_FRAMES

    def pixel_distance(self) -> float:
        """İlk-son arası adım adım toplam piksel mesafesi."""
        if len(self.samples) < 2:
            return 0.0
        total = 0.0
        for a, b in zip(self.samples, self.samples[1:]):
            total += float(np.hypot(b.cx - a.cx, b.cy - a.cy))
        return total

    def dominant_team(self) -> int:
        """Track boyunca en çok çıkan takım etiketi (frame başına yeniden KMeans
        olduğu için her örnek farklı etiket alabilir; çoğunluk daha güvenilir)."""
        if not self.samples:
            return -1
        from collections import Counter
        counts = Counter(s.team for s in self.samples if s.team in (0, 1))
        if not counts:
            return -1
        return counts.most_common(1)[0][0]

    def active_minutes(self) -> tuple[int, int]:
        """Track'in görüldüğü ilk ve son dakika (maç içi)."""
        if not self.samples:
            return (0, 0)
        first = int(self.samples[0].timestamp_sec // 60)
        last = int(self.samples[-1].timestamp_sec // 60)
        return (first, last)


class PlayerTracker:
    """Frame'ler arası eşleştirici. Tek video ömrü boyunca yaşar."""

    def __init__(self) -> None:
        self._active: dict[int, PlayerTrack] = {}
        self._archived: list[PlayerTrack] = []
        self._next_id: int = 1

    def update(
        self,
        detections: list[Detection],
        team_labels: list[int],
        frame_idx: int,
        timestamp_sec: float,
    ) -> list[Optional[int]]:
        """Bu frame'deki tespitleri mevcut track'lere eşle, eşleşmeyenlere
        yeni track aç. Her tespite atanan track_id listesini döner
        (None = atlandı)."""
        n = len(detections)
        assigned: list[Optional[int]] = [None] * n
        if n == 0:
            self._age_unmatched(set())
            return assigned

        # Mevcut aktif track'lerin son pozisyonlarını çıkar
        active_ids = list(self._active.keys())
        if not active_ids:
            # Tüm tespitlere yeni ID ver
            for i, det in enumerate(detections):
                tid = self._new_track(det, team_labels[i], frame_idx, timestamp_sec)
                assigned[i] = tid
            return assigned

        # Maliyet matrisi: tracks × detections (merkez mesafesi)
        cost = np.full((len(active_ids), n), 1e6, dtype=np.float32)
        for ti, tid in enumerate(active_ids):
            last = self._active[tid].last
            last_size = max(1.0, (last.width + last.height) / 2.0)
            for di, det in enumerate(detections):
                dcx, dcy = det.center
                dx, dy = dcx - last.cx, dcy - last.cy
                dist = float(np.hypot(dx, dy))
                if dist > MAX_MATCH_DISTANCE_PX:
                    continue
                det_size = max(1.0, ((det.x2 - det.x1) + (det.y2 - det.y1)) / 2.0)
                ratio = max(det_size / last_size, last_size / det_size)
                if ratio > MAX_SIZE_RATIO:
                    continue
                # Boyut benzerliğini hafif penaltı olarak ekle
                cost[ti, di] = dist + (ratio - 1.0) * 10.0

        row_ind, col_ind = linear_sum_assignment(cost)
        matched_tracks: set[int] = set()
        matched_dets: set[int] = set()
        for ti, di in zip(row_ind, col_ind):
            if cost[ti, di] >= 1e5:  # eşik üstünde — eşleşme sayma
                continue
            tid = active_ids[ti]
            det = detections[di]
            sample = TrackSample(
                frame_idx=frame_idx,
                timestamp_sec=timestamp_sec,
                cx=det.center[0],
                cy=det.center[1],
                width=det.x2 - det.x1,
                height=det.y2 - det.y1,
                team=team_labels[di],
                confidence=det.confidence,
            )
            self._active[tid].samples.append(sample)
            self._active[tid].lost_frames = 0
            assigned[di] = tid
            matched_tracks.add(tid)
            matched_dets.add(di)

        # Eşleşmeyen tespitler için yeni track
        for di, det in enumerate(detections):
            if di in matched_dets:
                continue
            tid = self._new_track(det, team_labels[di], frame_idx, timestamp_sec)
            assigned[di] = tid

        self._age_unmatched(matched_tracks)
        return assigned

    def _new_track(
        self,
        det: Detection,
        team: int,
        frame_idx: int,
        timestamp_sec: float,
    ) -> int:
        tid = self._next_id
        self._next_id += 1
        sample = TrackSample(
            frame_idx=frame_idx,
            timestamp_sec=timestamp_sec,
            cx=det.center[0],
            cy=det.center[1],
            width=det.x2 - det.x1,
            height=det.y2 - det.y1,
            team=team,
            confidence=det.confidence,
        )
        self._active[tid] = PlayerTrack(id=tid, samples=[sample])
        return tid

    def _age_unmatched(self, matched_tracks: set[int]) -> None:
        """Eşleşmeyen track'leri yaşlandır; çok kayıpsa arşivle."""
        to_archive: list[int] = []
        for tid, track in self._active.items():
            if tid in matched_tracks:
                continue
            track.lost_frames += 1
            if track.lost_frames > MAX_LOST_FRAMES:
                to_archive.append(tid)
        for tid in to_archive:
            self._archived.append(self._active.pop(tid))

    def all_tracks(self) -> list[PlayerTrack]:
        """Hem aktif hem arşivlenmiş tüm track'leri döner."""
        return list(self._active.values()) + self._archived
