"""Canlı maç oturumu yöneticisi.

Tek bir kamera akışı oturumu boyunca tracker + sahiplenme + olay state'ini
bellek içinde tutar. Browser her 2 sn'de bir frame gönderir; her POST için
ilgili oturum bulunup analiz çalıştırılır.

Stateless API yerine session-based çünkü:
- Tracker frame'ler arası ID korumak için önceki state'i bilmeli
- Sahiplenme geçişi debounce için son N sample tutulmalı
- Sınırlı oturum sayısı (kullanıcı başına 1) — bellek sorun değil
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from threading import Lock
from typing import Optional

from services.ball_analyzer import (
    BallAggregate,
    FrameBallInfo,
    POSSESSION_SWITCH_DEBOUNCE,
    UNKNOWN_TEAM,
    aggregate_to_dict,
)
from services.player_tracker import PlayerTracker
from services.zone_analyzer import ZONE_NAMES

# Bir oturum son ping'inden N saniye geçmişse temizlenebilir
SESSION_IDLE_TIMEOUT_SEC = 600.0  # 10 dakika


@dataclass
class LiveEvent:
    """Canlı akışta üretilen anlık olay (UI'a ticker olarak akar)."""
    type: str  # "possession_switch" | "high_pressure" | "team_in_attack" vb.
    minute: int
    second: int
    text: str  # UI'da görünecek hazır Türkçe yazı
    details: dict = field(default_factory=dict)


@dataclass
class LiveSession:
    """Tek bir canlı maç oturumunun bellek state'i."""
    id: str
    started_at: float
    last_seen_at: float
    frame_count: int = 0
    tracker: PlayerTracker = field(default_factory=PlayerTracker)
    ball_agg: BallAggregate = field(default_factory=BallAggregate)
    # Sahiplenme geçişi debounce için son teyit edilen takım + bekleyen aday
    last_confirmed_team: int = UNKNOWN_TEAM
    pending_switch_team: int = UNKNOWN_TEAM
    pending_count: int = 0
    # Yüksek pres tetiği için son emit zamanı (sn) — spam önlemek
    last_high_pressure_at: float = -999.0
    events: list[LiveEvent] = field(default_factory=list)


class LiveSessionRegistry:
    """Tüm aktif oturumları yöneten thread-safe registry."""

    def __init__(self) -> None:
        self._sessions: dict[str, LiveSession] = {}
        self._lock = Lock()

    def create(self, session_id: str) -> LiveSession:
        with self._lock:
            now = time.time()
            session = LiveSession(id=session_id, started_at=now, last_seen_at=now)
            self._sessions[session_id] = session
            self._cleanup_expired_locked(now)
            return session

    def get(self, session_id: str) -> Optional[LiveSession]:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is not None:
                session.last_seen_at = time.time()
            return session

    def end(self, session_id: str) -> Optional[LiveSession]:
        with self._lock:
            return self._sessions.pop(session_id, None)

    def _cleanup_expired_locked(self, now: float) -> None:
        """Zaman aşımına uğramış oturumları sil (lock altında çağrılır)."""
        expired = [
            sid for sid, s in self._sessions.items()
            if now - s.last_seen_at > SESSION_IDLE_TIMEOUT_SEC
        ]
        for sid in expired:
            self._sessions.pop(sid, None)


# Process-yaşam-boyu tek registry
registry = LiveSessionRegistry()


def update_session_with_ball_info(
    session: LiveSession,
    info: FrameBallInfo,
) -> list[LiveEvent]:
    """Tek frame'in top/sahiplenme bilgisini oturum agregatına işler ve
    bu frame'de tetiklenen olayları döner.

    Bu, ball_analyzer.aggregate_ball'ın streaming sürümüdür: maç bitmeden
    debounce + olay üretimi yapmaya devam edebilmek için state'i oturumda
    tutar."""
    new_events: list[LiveEvent] = []
    agg = session.ball_agg
    agg.frames_total += 1

    if not info.has_ball:
        return new_events

    agg.frames_with_ball += 1
    if info.zone:
        agg.zone_counts[info.zone] = agg.zone_counts.get(info.zone, 0) + 1

    if info.possession_team == 0:
        agg.possession_a += 1
    elif info.possession_team == 1:
        agg.possession_b += 1
    else:
        agg.possession_unknown += 1

    current = info.possession_team
    if current not in (0, 1):
        return new_events

    if session.last_confirmed_team == UNKNOWN_TEAM:
        session.last_confirmed_team = current
        session.pending_switch_team = UNKNOWN_TEAM
        session.pending_count = 0
    elif current == session.last_confirmed_team:
        session.pending_switch_team = UNKNOWN_TEAM
        session.pending_count = 0
    else:
        if current == session.pending_switch_team:
            session.pending_count += 1
        else:
            session.pending_switch_team = current
            session.pending_count = 1
        if session.pending_count >= POSSESSION_SWITCH_DEBOUNCE:
            from_label = 'A' if session.last_confirmed_team == 0 else 'B'
            to_label = 'A' if current == 0 else 'B'
            event = LiveEvent(
                type="possession_switch",
                minute=info.minute,
                second=int(info.timestamp_sec % 60),
                text=f"Sahiplenme {from_label} → {to_label}",
                details={
                    "from_team": session.last_confirmed_team,
                    "to_team": current,
                    "timestamp_sec": round(info.timestamp_sec, 1),
                },
            )
            agg.events.append({
                "minute": info.minute,
                "timestamp_sec": round(info.timestamp_sec, 1),
                "type": "possession_switch",
                "from_team": session.last_confirmed_team,
                "to_team": current,
            })
            session.events.append(event)
            new_events.append(event)
            session.last_confirmed_team = current
            session.pending_switch_team = UNKNOWN_TEAM
            session.pending_count = 0

    return new_events


def maybe_emit_pressure_event(
    session: LiveSession,
    pressure_score: float,
    minute: int,
    timestamp_sec: float,
) -> Optional[LiveEvent]:
    """Yüksek pres anı için olay üret (cooldown ile spam önlenir)."""
    # 80+ pres = takımlar üst üste, yüksek tempo
    if pressure_score < 80:
        return None
    # En az 30 sn ara olmalı iki yüksek pres olay arasında
    if timestamp_sec - session.last_high_pressure_at < 30.0:
        return None
    session.last_high_pressure_at = timestamp_sec
    event = LiveEvent(
        type="high_pressure",
        minute=minute,
        second=int(timestamp_sec % 60),
        text=f"Yüksek pres anı ({pressure_score:.0f}/100)",
        details={"pressure_score": round(pressure_score, 1)},
    )
    session.events.append(event)
    return event


def serialize_event(ev: LiveEvent) -> dict:
    """API yanıtı için olay sözleşmesi."""
    return {
        "type": ev.type,
        "minute": ev.minute,
        "second": ev.second,
        "text": ev.text,
        "details": ev.details,
    }


def serialize_session_summary(session: LiveSession) -> dict:
    """Yan panel + skorboard için anlık özet."""
    agg = session.ball_agg
    total = agg.possession_a + agg.possession_b + agg.possession_unknown
    denom = max(1, total)
    return {
        "session_id": session.id,
        "frames_processed": session.frame_count,
        "elapsed_sec": round(time.time() - session.started_at, 1),
        "ball": {
            "frames_with_ball": agg.frames_with_ball,
            "visibility": round(agg.frames_with_ball / max(1, agg.frames_total), 3),
            "possession": {
                "a": round(agg.possession_a / denom, 3),
                "b": round(agg.possession_b / denom, 3),
                "unknown": round(agg.possession_unknown / denom, 3),
            },
            "zone_counts": dict(agg.zone_counts),
        },
        "events_total": len(session.events),
        "recent_events": [serialize_event(ev) for ev in session.events[-20:]],
    }
