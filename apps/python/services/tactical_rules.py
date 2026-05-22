"""Sapma kontrol motoru (Football Manager mantığı).

`MatchPlan` eşiklerini referans alır; mevcut frame'in metriklerini PLANLA
karşılaştırır; sapma varsa `TacticalCommand` üretir. Saf hesaplama — AI yok.

Her kuralın 25 sn cooldown'u var: aynı uyarı tekrarlanmaz.

Çekirdek karar (PROMPT.md §5/2): eşikler SABİT değil, plandan gelir.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from services.match_plan import MatchPlan
from services.zone_analyzer import FrameMetrics


Severity = Literal["RISK", "WARN", "OPPORTUNITY"]

# Aynı kuralı tekrar tetiklemeden önce beklenecek minimum süre
RULE_COOLDOWN_SEC = 25.0

# Kanat yığılma kuralının anlamlı olduğu minimum görünen oyuncu sayısı
WING_MIN_PLAYERS = 5


@dataclass
class TacticalCommand:
    """Sapma uyarısı — UI'da kart, WS akışında JSON mesajı olarak iletilir."""

    rule_id: str  # örn. "line_too_open", "wing_open_left"
    severity: Severity
    title: str  # Türkçe kısa başlık ("Savunma açıldı")
    text: str  # Ölçüm + plan eşiği bağlamı
    minute: int
    second: int
    details: dict = field(default_factory=dict)


@dataclass
class RuleEngine:
    """Oturum boyunca yaşar; kural başına son tetik zamanını tutar.

    `evaluate()` her frame'de çağrılır, cooldown'u bitmiş ve eşiği aşan
    kuralları döner. Plan referansı çağrı sırasında verilir, böylece kullanıcı
    maç ortasında planı güncellerse motor uyarlanır.
    """

    last_emit_at: dict[str, float] = field(default_factory=dict)

    def evaluate(
        self,
        metrics: FrameMetrics,
        plan: MatchPlan,
        minute: int,
        timestamp_sec: float,
    ) -> list[TacticalCommand]:
        out: list[TacticalCommand] = []
        thr = plan.thresholds

        # Kendi takım (A) referans alınır — kameranın takip ettiği taraf.
        # B (rakip) metrikleri sadece bağlam için scoreboard'da kullanılır;
        # plan ihlalleri kendi takım üzerinden değerlendirilir.
        comp_a = metrics.compactness_a

        # 1. line_too_open — savunma çizgisi açıldı (RİSK)
        if comp_a > thr.compactness_max_m:
            cmd = self._fire(
                rule_id="line_too_open",
                severity="RISK",
                title="Savunma açıldı",
                text=(
                    f"Dikey kompaktlık {comp_a:.0f}m "
                    f"(plan: ≤{thr.compactness_max_m:.0f}m)"
                ),
                minute=minute,
                ts=timestamp_sec,
                details={"compactness_m": round(comp_a, 1)},
            )
            if cmd:
                out.append(cmd)

        # 2. over_crowded — yığılma (DİKKAT)
        elif 0 < comp_a < thr.compactness_min_m:
            cmd = self._fire(
                rule_id="over_crowded",
                severity="WARN",
                title="Takım yığıldı",
                text=(
                    f"Dikey kompaktlık {comp_a:.0f}m "
                    f"(plan: ≥{thr.compactness_min_m:.0f}m)"
                ),
                minute=minute,
                ts=timestamp_sec,
                details={"compactness_m": round(comp_a, 1)},
            )
            if cmd:
                out.append(cmd)

        # 3. under_pressure — rakip baskısı altında (DİKKAT)
        if metrics.pressure_score > thr.pressure_max_opponent:
            cmd = self._fire(
                rule_id="under_pressure",
                severity="WARN",
                title="Baskı altındayız",
                text=(
                    f"Pres skoru {metrics.pressure_score:.0f} "
                    f"(plan: ≤{thr.pressure_max_opponent:.0f})"
                ),
                minute=minute,
                ts=timestamp_sec,
                details={"pressure_score": round(metrics.pressure_score, 1)},
            )
            if cmd:
                out.append(cmd)

        # 4. wing_open_left / wing_open_right — kanat dengesizliği (FIRSAT)
        out.extend(self._wing_rules(metrics, thr.wing_imbalance_max, minute, timestamp_sec))

        return out

    def _wing_rules(
        self,
        metrics: FrameMetrics,
        threshold: float,
        minute: int,
        ts: float,
    ) -> list[TacticalCommand]:
        zones = metrics.zones_a
        total = sum(zones.values())
        if total < WING_MIN_PLAYERS:
            return []

        col_left = zones.get("top_left", 0) + zones.get("mid_left", 0) + zones.get("bot_left", 0)
        col_right = zones.get("top_right", 0) + zones.get("mid_right", 0) + zones.get("bot_right", 0)

        left_ratio = col_left / total
        right_ratio = col_right / total

        out: list[TacticalCommand] = []
        if right_ratio > threshold:
            cmd = self._fire(
                rule_id="wing_open_left",
                severity="OPPORTUNITY",
                title="Sol kanat boş",
                text=f"Takımın %{right_ratio * 100:.0f}'i sağda",
                minute=minute,
                ts=ts,
                details={"right_ratio": round(right_ratio, 2)},
            )
            if cmd:
                out.append(cmd)
        if left_ratio > threshold:
            cmd = self._fire(
                rule_id="wing_open_right",
                severity="OPPORTUNITY",
                title="Sağ kanat boş",
                text=f"Takımın %{left_ratio * 100:.0f}'i solda",
                minute=minute,
                ts=ts,
                details={"left_ratio": round(left_ratio, 2)},
            )
            if cmd:
                out.append(cmd)
        return out

    def _fire(
        self,
        rule_id: str,
        severity: Severity,
        title: str,
        text: str,
        minute: int,
        ts: float,
        details: dict,
    ) -> TacticalCommand | None:
        """Cooldown kontrolü; geçtiyse komut üretir + kaydını günceller."""
        last = self.last_emit_at.get(rule_id, -1e9)
        if ts - last < RULE_COOLDOWN_SEC:
            return None
        self.last_emit_at[rule_id] = ts
        return TacticalCommand(
            rule_id=rule_id,
            severity=severity,
            title=title,
            text=text,
            minute=minute,
            second=int(ts % 60),
            details=details,
        )


def serialize_command(cmd: TacticalCommand) -> dict:
    """UI/WS sözleşmesi."""
    return {
        "rule_id": cmd.rule_id,
        "severity": cmd.severity,
        "title": cmd.title,
        "text": cmd.text,
        "minute": cmd.minute,
        "second": cmd.second,
        "details": cmd.details,
    }
