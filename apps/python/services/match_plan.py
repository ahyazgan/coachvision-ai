"""Maç planı veri yapısı (Football Manager mantığı).

Teknik direktör maç öncesi planını burada kurgular: diziliş, oyuncu görevleri,
takım talimatları ve taktik eşik değerleri. Bu plan, `tactical_rules.py`
sapma kontrol motoruna referans olarak verilir — sistem sahada GERÇEKLEŞENİ
ölçüp PLANLA karşılaştırır, sapma varsa uyarı üretir.

Bu modül saf veri (no I/O, no inference). Validation + JSON serileştirme yapar;
Prisma'daki `MatchPlan` modelinden gelen JSON alanlarını burada parse edip
type-safe dataclass'a çeviririz, tersi de geçerli.

Kullanım:
    plan = MatchPlan.default()
    plan.thresholds.compactness_max_m = 35.0  # bu maçta daha sıkı tutalım
    rules.evaluate(metrics, plan)  # tactical_rules.py içinde
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any, Literal


# -----------------------------------------------------------------------------
# Sabit kümeler — UI dropdown'larıyla bire bir eşleşir
# -----------------------------------------------------------------------------

DefensiveLine = Literal["low", "mid", "high"]
PressingIntensity = Literal["low", "mid", "high"]
PossessionStyle = Literal["build_up", "balanced", "direct"]
Width = Literal["narrow", "balanced", "wide"]
Tempo = Literal["slow", "medium", "fast"]

# Saha pozisyonları — diziliş satırlarıyla uyumlu kısa kodlar.
# Spesifik (CB, LB, RCM) + jenerik kategoriler (DF, MF, FW) kabul edilir;
# UI slot generator jenerik kategorilerle çalışır.
POSITION_CODES = {
    "GK", "DF", "MF", "FW",  # jenerik kategoriler
    "RB", "RCB", "CB", "LCB", "LB", "RWB", "LWB",
    "CDM", "RCM", "CM", "LCM", "CAM",
    "RM", "LM", "RW", "LW",
    "RF", "ST", "CF", "LF",
}

# Diziliş regex: rakam-rakam[-rakam[-rakam]] toplamı 10 (kaleci hariç)
_FORMATION_RE = re.compile(r"^\d(?:-\d){1,3}$")


# -----------------------------------------------------------------------------
# Alt yapılar
# -----------------------------------------------------------------------------


@dataclass
class TeamInstructions:
    """Genel takım davranışı — antrenörün maça giriş yaklaşımı."""

    defensive_line: DefensiveLine = "mid"
    pressing: PressingIntensity = "mid"
    possession_style: PossessionStyle = "balanced"
    width: Width = "balanced"
    tempo: Tempo = "medium"
    # Serbest metin — Claude prompt'unda doğrudan kullanılır
    notes: str = ""


@dataclass
class PlayerAssignment:
    """Bir oyuncuya verilen pozisyon + rol + özel talimatlar.

    player_id Prisma `Player.id`'ye karşılık gelir; sahada karşılığı yoksa
    (sentetik plan / pre-season) boş bırakılabilir.
    """

    position: str  # POSITION_CODES'tan biri
    role: str  # serbest — örn. "ball_playing_defender", "inverted_winger"
    player_id: str | None = None
    instructions: list[str] = field(default_factory=list)


@dataclass
class TacticalThresholds:
    """Sapma motorunun referans aldığı sayısal eşikler — hepsi `zone_analyzer.py`
    çıktısıyla aynı birimde.

    - compactness_*_m: takımın dikey kompaktlığı (metre). zone_analyzer
      `PITCH_HEIGHT_METERS=68` ile normalize edip metreye çeviriyor.
    - pressure_*: 0-100 arası heuristic pres skoru.
    - wing_imbalance_max: 3x3 grid'in bir sütununa düşen oyuncu oranı
      (0-1). Bu üstüne çıkılırsa "diğer kanat boş" sinyali.
    """

    # Savunma açıldı / yığıldı sınırları (metre)
    compactness_max_m: float = 38.0
    compactness_min_m: float = 18.0
    # Pres yoğunluğu (0-100, zone_analyzer çıktısı)
    pressure_min_self: float = 30.0  # bu altındaysak "yetersiz baskı"
    pressure_max_opponent: float = 70.0  # bu üstündeyse "sıkıştık"
    # Bir kanadın 3 sütunundan birine yığılma oranı (0-1)
    wing_imbalance_max: float = 0.60
    # Top sahipleme dengesi — kendi oranımız bu altındaysa uyarı
    possession_min_self: float = 0.40


# -----------------------------------------------------------------------------
# Ana plan
# -----------------------------------------------------------------------------


@dataclass
class MatchPlan:
    """Antrenörün bir maç için kurguladığı tam plan.

    Prisma'da `MatchPlan` modeli olarak saklanır. teamInstructions /
    playerAssignments / thresholds Json alanları bu dataclass'tan
    `to_dict()` ile üretilir.
    """

    formation: str  # "4-3-3", "4-2-3-1" vb.
    name: str = "Varsayılan plan"
    team_instructions: TeamInstructions = field(default_factory=TeamInstructions)
    player_assignments: list[PlayerAssignment] = field(default_factory=list)
    thresholds: TacticalThresholds = field(default_factory=TacticalThresholds)
    # Saha kalibrasyon ayarları (PitchCalibrator.to_dict çıktısı). Yoksa
    # kompaktlık yaklaşık metre cinsinde kalır; varsa gerçek metre olur.
    calibration: dict | None = None
    notes: str = ""

    # -- Yapılandırma / Yardımcılar -------------------------------------------

    @classmethod
    def default(cls) -> "MatchPlan":
        """Makul varsayılan plan — UI'da yeni plan açılınca başlangıç noktası."""
        return cls(formation="4-3-3")

    def to_dict(self) -> dict[str, Any]:
        """Prisma Json alanlarına yazılacak temiz dict."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "MatchPlan":
        """Prisma'dan gelen Json'u type-safe nesneye çevir.

        Bilinmeyen alanlar yoksayılır (forward-compat), eksik alanlar
        varsayılana düşer.
        """
        ti_raw = data.get("team_instructions") or {}
        th_raw = data.get("thresholds") or {}
        pa_raw = data.get("player_assignments") or []

        return cls(
            formation=str(data.get("formation", "4-3-3")),
            name=str(data.get("name", "Varsayılan plan")),
            team_instructions=TeamInstructions(
                defensive_line=ti_raw.get("defensive_line", "mid"),
                pressing=ti_raw.get("pressing", "mid"),
                possession_style=ti_raw.get("possession_style", "balanced"),
                width=ti_raw.get("width", "balanced"),
                tempo=ti_raw.get("tempo", "medium"),
                notes=str(ti_raw.get("notes", "")),
            ),
            player_assignments=[
                PlayerAssignment(
                    position=str(p.get("position", "")),
                    role=str(p.get("role", "")),
                    player_id=p.get("player_id"),
                    instructions=list(p.get("instructions") or []),
                )
                for p in pa_raw
                if p.get("position")
            ],
            thresholds=TacticalThresholds(
                compactness_max_m=float(th_raw.get("compactness_max_m", 38.0)),
                compactness_min_m=float(th_raw.get("compactness_min_m", 18.0)),
                pressure_min_self=float(th_raw.get("pressure_min_self", 30.0)),
                pressure_max_opponent=float(th_raw.get("pressure_max_opponent", 70.0)),
                wing_imbalance_max=float(th_raw.get("wing_imbalance_max", 0.60)),
                possession_min_self=float(th_raw.get("possession_min_self", 0.40)),
            ),
            calibration=data.get("calibration"),
            notes=str(data.get("notes", "")),
        )

    # -- Validasyon -----------------------------------------------------------

    def validate(self) -> list[str]:
        """Planın iç tutarlılığını kontrol et — hata listesi döner.

        Boş liste = plan geçerli. UI'da `Bu plana göre maça hazır mıyız?`
        butonu bu listeyi kullanır.
        """
        errors: list[str] = []

        if not _FORMATION_RE.match(self.formation):
            errors.append(
                f"Diziliş biçimi geçersiz: '{self.formation}' "
                "(örn. '4-3-3', '4-2-3-1')"
            )
        else:
            outfield = sum(int(n) for n in self.formation.split("-"))
            if outfield != 10:
                errors.append(
                    f"Diziliş 10 saha oyuncusu olmalı (kaleci hariç), "
                    f"şu an {outfield}"
                )

        for i, pa in enumerate(self.player_assignments):
            if pa.position not in POSITION_CODES:
                errors.append(
                    f"Atama #{i + 1}: bilinmeyen pozisyon kodu '{pa.position}'"
                )

        th = self.thresholds
        if th.compactness_min_m >= th.compactness_max_m:
            errors.append(
                "Kompaktlık min eşiği max'tan büyük veya eşit — "
                "ranj geçersiz"
            )
        if not (0.0 <= th.wing_imbalance_max <= 1.0):
            errors.append("wing_imbalance_max 0-1 aralığında olmalı")
        if not (0.0 <= th.possession_min_self <= 1.0):
            errors.append("possession_min_self 0-1 aralığında olmalı")
        if not (0.0 <= th.pressure_min_self <= 100.0):
            errors.append("pressure_min_self 0-100 aralığında olmalı")
        if not (0.0 <= th.pressure_max_opponent <= 100.0):
            errors.append("pressure_max_opponent 0-100 aralığında olmalı")

        return errors
