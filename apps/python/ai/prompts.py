"""Claude prompt şablonları (Türkçe)."""
from __future__ import annotations

COACH_SYSTEM_PROMPT = """Sen profesyonel bir futbol antrenör asistanısın. Türkçe konuşuyorsun.

Görevin:
- Kısa, net, pratik tavsiyeler ver
- Taktik terminolojisi kullan
- Maximum 3-4 cümle
- Emoji kullan (⚡🎯⚠️)
- "Bence" yerine "Önerim:" başlat
"""


def build_frame_analysis_prompt(
    minute: int,
    player_count_a: int,
    player_count_b: int,
    compactness_a: float,
    compactness_b: float,
    pressure_score: float,
) -> str:
    """Tek bir analiz frame'i için kullanıcı mesajı üretir."""
    return f"""Maç dakikası: {minute}
Takım A oyuncu sayısı (görüntüde): {player_count_a}
Takım B oyuncu sayısı (görüntüde): {player_count_b}
Takım A dikey kompaktlık: {compactness_a:.1f} m
Takım B dikey kompaktlık: {compactness_b:.1f} m
Pres yoğunluğu: {pressure_score:.0f}/100

Bu kareye dayalı kısa bir taktik gözlem ve antrenöre tek somut tavsiye yaz."""


def build_segment_analysis_prompt(
    minute_from: int,
    minute_to: int,
    frames_count: int,
    avg_count_a: float,
    avg_count_b: float,
    avg_compactness_a: float,
    avg_compactness_b: float,
    pressure_min: float,
    pressure_avg: float,
    pressure_max: float,
    compactness_trend_a: str,
    compactness_trend_b: str,
) -> str:
    """Maçın belli bir zaman diliminin (örn. 5 dk) toplu yorumu için mesaj.

    Tek frame'den farkı: ortalama + min/max + trend (artıyor/azalıyor) verir,
    böylece Claude o dilimde neyin değiştiğini görebilir.
    """
    return f"""Maç dilimi: {minute_from}'-{minute_to}' arası ({frames_count} frame analizi)
Takım A ortalama oyuncu: {avg_count_a:.1f}
Takım B ortalama oyuncu: {avg_count_b:.1f}
Takım A ortalama dikey kompaktlık: {avg_compactness_a:.1f} m ({compactness_trend_a})
Takım B ortalama dikey kompaktlık: {avg_compactness_b:.1f} m ({compactness_trend_b})
Pres yoğunluğu: min {pressure_min:.0f} · ort {pressure_avg:.0f} · max {pressure_max:.0f} / 100

Bu zaman dilimi için: (1) ne olduğunu 1 cümle özetle, (2) antrenöre 1 somut tavsiye ver. Toplam 2-3 cümle."""
