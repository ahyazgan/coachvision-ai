"""Rakip diziliş tespiti.

Bir videodan N kare örnekler, YOLO + K-means takım sınıflayıcısı ile takım B
(rakip) oyuncularını ayırır, sahanın uzun ekseni boyunca (Y eksen) K-means ile
3-4 satıra kümeler ve "4-3-3" gibi diziliş string'i çıkarır.

Sınırlamalar:
- Saha homografisiz: piksel Y koordinatı kullanılır (perspektif distortion var).
  Kalibre edilmiş video varsa to_meters kullanılarak daha doğru olur ama UI
  şu an her video için kalibrasyon istemiyor.
- 11 oyuncu varsayar; eksik tespitler dizilişi yanlış raporlayabilir.
- En geride kalan en küçük küme kaleci sayılır ve dizilişten düşülür.

Güven skoru = ortalama küme yoğunluğu (her oyuncunun kendi küme merkezine
ne kadar yakın olduğu) — düşükse "?-?-?" tarzı belirsiz dağılım vardır.
"""
from __future__ import annotations

import logging
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sklearn.cluster import KMeans

from services.player_detector import detect_players_and_ball
from services.team_classifier import TeamColorModel, classify_with_model

log = logging.getLogger(__name__)
router = APIRouter()


class DetectFormationRequest(BaseModel):
    file_path: str
    sample_count: int = 8
    # Hangi takım analiz edilsin — None ise B (rakip) varsayılır
    team: str = "B"  # "A" veya "B"


class FormationResult(BaseModel):
    formation: str  # "4-3-3" tarzı
    row_counts: list[int]  # En geriden öne sıralı (kaleci hariç)
    confidence: float  # 0..1
    frames_used: int
    total_player_samples: int
    notes: str


def _resolve_path(file_path: str) -> Path:
    p = Path(file_path)
    if p.is_absolute() and p.exists():
        return p
    root = Path(__file__).resolve().parents[3]
    cand = root / "uploads" / "videos" / Path(file_path).name
    if cand.exists():
        return cand
    cand2 = root / file_path
    if cand2.exists():
        return cand2
    raise FileNotFoundError(f"Video bulunamadı: {file_path}")


def _sample_frames(cap: cv2.VideoCapture, count: int) -> list[np.ndarray]:
    """Videoyu eşit aralıklarla `count` kez örnekle."""
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total <= 0:
        return []
    step = max(1, total // max(1, count))
    frames: list[np.ndarray] = []
    for i in range(count):
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(total - 1, i * step))
        ok, frame = cap.read()
        if ok and frame is not None:
            frames.append(frame)
    return frames


def _detect_formation(y_coords: list[float], k: int = 4) -> tuple[list[int], float]:
    """Y koordinatlarını k satıra kümele; en geride küçük küme kaleci sayılır.

    Returns:
        (row_counts en-geriden-öne, ortalama küme yoğunluğu 0..1)
    """
    if len(y_coords) < k:
        return [], 0.0
    arr = np.array(y_coords, dtype=np.float32).reshape(-1, 1)
    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(arr)
    labels = km.labels_
    centers = km.cluster_centers_.flatten()
    counts = Counter(int(l) for l in labels)

    # Cluster'ları merkez Y'sine göre sırala (saha derinliği yönünde)
    order = sorted(range(k), key=lambda i: centers[i])
    sorted_counts = [counts[i] for i in order]
    sorted_centers = [centers[i] for i in order]

    # En geriden ilk küçük küme = kaleci varsayımı
    gk_idx = None
    for i in range(len(sorted_counts)):
        # 1-2 kişilik bir cluster + sahanın bir ucunda
        if sorted_counts[i] <= 2 and (i == 0 or i == len(sorted_counts) - 1):
            gk_idx = i
            break

    rows = list(sorted_counts)
    if gk_idx is not None:
        rows.pop(gk_idx)

    # Yoğunluk (confidence): ortalama nokta-merkez mesafesi → tersi ile normalize
    dists = []
    for i, c in enumerate(centers):
        cluster_pts = arr[labels == i].flatten()
        if len(cluster_pts) == 0:
            continue
        dists.extend(abs(cluster_pts - c).tolist())
    if not dists:
        return rows, 0.0
    mean_d = float(np.mean(dists))
    # Normalize (0.05 = çok sıkı küme, 0.20 = çok dağınık)
    confidence = max(0.0, min(1.0, 1.0 - (mean_d / 0.20)))
    return rows, confidence


@router.post("/detect-formation", response_model=FormationResult)
async def detect_formation(req: DetectFormationRequest) -> FormationResult:
    try:
        path = _resolve_path(req.file_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Video açılamadı")
    try:
        frames = _sample_frames(cap, max(3, min(20, req.sample_count)))
    finally:
        cap.release()
    if not frames:
        raise HTTPException(status_code=400, detail="Hiç frame örneklenemedi")

    team_model = TeamColorModel()
    y_coords: list[float] = []
    target_team_label = 0 if req.team.upper() == "A" else 1

    for frame in frames:
        h = frame.shape[0]
        players, _ball = detect_players_and_ball(frame)
        if not players:
            continue
        labels, _centers = classify_with_model(frame, players, team_model)
        for det, lab in zip(players, labels):
            if lab != target_team_label:
                continue
            # Ayak (alt orta) Y'sini normalize et
            y_norm = det.y2 / h
            y_coords.append(float(y_norm))

    if len(y_coords) < 8:
        return FormationResult(
            formation="?-?-?",
            row_counts=[],
            confidence=0.0,
            frames_used=len(frames),
            total_player_samples=len(y_coords),
            notes="Yeterli oyuncu tespiti yok (sahnede rakip oyuncular az veya yanlış takım tahmini)",
        )

    rows, conf = _detect_formation(y_coords, k=4)
    if not rows:
        return FormationResult(
            formation="?-?-?",
            row_counts=[],
            confidence=conf,
            frames_used=len(frames),
            total_player_samples=len(y_coords),
            notes="Küme tahmini başarısız",
        )

    formation_str = "-".join(str(r) for r in rows)
    notes = "Kaleci hariç, en geriden öne doğru"
    if sum(rows) != 10:
        notes += f" · toplam {sum(rows)} oyuncu (10 beklenirdi)"

    return FormationResult(
        formation=formation_str,
        row_counts=rows,
        confidence=round(conf, 3),
        frames_used=len(frames),
        total_player_samples=len(y_coords),
        notes=notes,
    )
