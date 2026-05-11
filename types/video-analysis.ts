// Python pipeline tarafından üretilen zaman serisi yorumlar.
// Tek dilim = SEGMENT_MINUTES (varsayılan 5) dakikalık zaman penceresi.

export interface SegmentAdvice {
  minute_from: number
  minute_to: number
  frames_count: number
  avg_count_a: number
  avg_count_b: number
  avg_compactness_a: number
  avg_compactness_b: number
  pressure_avg: number
  pressure_min: number
  pressure_max: number
  advice: string
}

// Tek bir stabil oyuncu izi (frame'ler arası eşleşmiş tespitlerin özeti).
// pixel_distance gerçek metre değildir — homografi yok, kameraya/zoom'a göre
// değişir; aynı maç içinde göreceli karşılaştırma için anlamlıdır.
export interface PlayerTrackSummary {
  id: number
  team: number // 0 = A, 1 = B, -1 = belirsiz
  frames: number
  pixel_distance: number
  active_from_minute: number
  active_to_minute: number
  avg_confidence: number
}

// Sahiplenme geçişi olayı (debounce: 2 frame teyitli).
export interface BallEvent {
  minute: number
  timestamp_sec: number
  type: 'possession_switch'
  from_team: number
  to_team: number
}

// Maç boyu top + sahiplenme + olay özeti.
export interface BallStats {
  frames_with_ball: number
  frames_total: number
  ball_visibility: number // 0-1; top kaç frame'de tespit edildi
  possession: {
    a: number // 0-1
    b: number
    unknown: number
  }
  zone_counts: Record<string, number> // top hangi 3x3 hücrede kaç frame durdu
  events: BallEvent[]
}
