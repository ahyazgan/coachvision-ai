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
