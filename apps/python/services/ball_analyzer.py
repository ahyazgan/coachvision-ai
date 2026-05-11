"""Top + sahiplenme (possession) + olay yakalama.

Pipeline frame frame top pozisyonunu okur; en yakın oyuncunun takımını
sahiplenme sahibi sayar. Maç boyunca:
- Sahiplenme yüzdesi (A / B / belirsiz)
- Top bölge dağılımı (3x3 grid)
- Olay listesi: sahiplenme geçişi (2+ frame teyitli, gürültü filtreli)

Homografi olmadığı için "ceza alanı" yerine "saha bölgesi" üzerinden konuş —
bölge 1-9 hangi alanda zaman geçirildiği görünür.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from services.pitch_detector import PitchInfo
from services.player_detector import BallDetection, Detection
from services.team_classifier import OUTLIER_LABEL
from services.zone_analyzer import ZONE_NAMES, _zone_index

# Topun "kontrolde" sayılması için oyuncuya max piksel mesafesi.
# 1080p tactical çekimde oyuncu ayak-top mesafesi tipik 30-80 px.
MAX_POSSESSION_DISTANCE_PX = 120.0

# Sahiplenme geçişi olarak sayılması için: önceki sahip takımdan farklı bir
# takım N kere üst üste görülmeli (gürültü filtresi).
POSSESSION_SWITCH_DEBOUNCE = 2

UNKNOWN_TEAM = -2  # KMeans outlier -1 ile karıştırmamak için ayrı sentinel


@dataclass
class FrameBallInfo:
    """Tek frame için top + sahiplenme bilgisi."""
    minute: int
    timestamp_sec: float
    has_ball: bool
    zone: Optional[str]  # "top_left" vs.
    possession_team: int  # 0 / 1 / UNKNOWN_TEAM
    nearest_distance_px: Optional[float]


@dataclass
class BallAggregate:
    """Maç boyu top istatistikleri + olaylar."""
    frames_with_ball: int = 0
    frames_total: int = 0
    possession_a: int = 0
    possession_b: int = 0
    possession_unknown: int = 0
    zone_counts: dict[str, int] = field(default_factory=lambda: {z: 0 for z in ZONE_NAMES})
    events: list[dict] = field(default_factory=list)


def analyze_frame_ball(
    ball: Optional[BallDetection],
    detections: list[Detection],
    team_labels: list[int],
    pitch: PitchInfo | None,
    frame_shape: tuple[int, int],
    minute: int,
    timestamp_sec: float,
) -> FrameBallInfo:
    """Tek frame için sahiplenme + bölge çıkar."""
    if ball is None:
        return FrameBallInfo(
            minute=minute,
            timestamp_sec=timestamp_sec,
            has_ball=False,
            zone=None,
            possession_team=UNKNOWN_TEAM,
            nearest_distance_px=None,
        )

    bx, by = ball.center

    # Top saha-dışı görünüyorsa (kameraman/seyirciden gelen yanlış pozitif)
    # bölge atama; ama "var" sayıyoruz, possession unknown
    on_pitch = pitch is None or pitch.contains(bx, by, tolerance=15)

    zone = None
    if on_pitch:
        if pitch is not None:
            rel_x = (bx - pitch.x) / max(1, pitch.width)
            rel_y = (by - pitch.y) / max(1, pitch.height)
        else:
            h, w = frame_shape
            rel_x = bx / max(1, w)
            rel_y = by / max(1, h)
        rel_x = max(0.0, min(1.0, rel_x))
        rel_y = max(0.0, min(1.0, rel_y))
        zone = _zone_index(rel_x, rel_y)

    # En yakın takımı bul (kaleci/hakem hariç)
    nearest_team = UNKNOWN_TEAM
    nearest_dist: Optional[float] = None
    for det, lbl in zip(detections, team_labels):
        if lbl == OUTLIER_LABEL:
            continue
        cx = (det.x1 + det.x2) / 2
        foot_y = det.y2
        dist = ((cx - bx) ** 2 + (foot_y - by) ** 2) ** 0.5
        if nearest_dist is None or dist < nearest_dist:
            nearest_dist = dist
            if dist <= MAX_POSSESSION_DISTANCE_PX:
                nearest_team = lbl
            else:
                nearest_team = UNKNOWN_TEAM

    return FrameBallInfo(
        minute=minute,
        timestamp_sec=timestamp_sec,
        has_ball=True,
        zone=zone,
        possession_team=nearest_team,
        nearest_distance_px=nearest_dist,
    )


def aggregate_ball(infos: list[FrameBallInfo]) -> BallAggregate:
    """Frame frame top bilgisini özet + olay listesine indirger."""
    agg = BallAggregate(frames_total=len(infos))

    # Debounce için son N frame'in possession'ı
    last_confirmed: int = UNKNOWN_TEAM
    pending_switch_team: int = UNKNOWN_TEAM
    pending_count: int = 0

    for info in infos:
        if info.has_ball:
            agg.frames_with_ball += 1
            if info.zone:
                agg.zone_counts[info.zone] = agg.zone_counts.get(info.zone, 0) + 1

            if info.possession_team == 0:
                agg.possession_a += 1
            elif info.possession_team == 1:
                agg.possession_b += 1
            else:
                agg.possession_unknown += 1

            # Sahiplenme geçişi tespiti — sadece A↔B geçişleri olaydır
            current = info.possession_team
            if current in (0, 1):
                if last_confirmed == UNKNOWN_TEAM:
                    last_confirmed = current
                    pending_switch_team = UNKNOWN_TEAM
                    pending_count = 0
                elif current == last_confirmed:
                    pending_switch_team = UNKNOWN_TEAM
                    pending_count = 0
                else:
                    if current == pending_switch_team:
                        pending_count += 1
                    else:
                        pending_switch_team = current
                        pending_count = 1
                    if pending_count >= POSSESSION_SWITCH_DEBOUNCE:
                        agg.events.append({
                            "minute": info.minute,
                            "timestamp_sec": round(info.timestamp_sec, 1),
                            "type": "possession_switch",
                            "from_team": last_confirmed,
                            "to_team": current,
                        })
                        last_confirmed = current
                        pending_switch_team = UNKNOWN_TEAM
                        pending_count = 0

    return agg


def aggregate_to_dict(agg: BallAggregate) -> dict:
    """Payload formatına çevir."""
    total_possession = agg.possession_a + agg.possession_b + agg.possession_unknown
    denom = max(1, total_possession)
    return {
        "frames_with_ball": agg.frames_with_ball,
        "frames_total": agg.frames_total,
        "ball_visibility": round(agg.frames_with_ball / max(1, agg.frames_total), 3),
        "possession": {
            "a": round(agg.possession_a / denom, 3),
            "b": round(agg.possession_b / denom, 3),
            "unknown": round(agg.possession_unknown / denom, 3),
        },
        "zone_counts": dict(agg.zone_counts),
        "events": list(agg.events),
    }
