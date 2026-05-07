/**
 * Maç bağlamına göre AI antrenör için Türkçe sistem prompt'u üretir.
 * Detaylı bağlam → daha isabetli taktik önerisi.
 */
export const COACH_BASE_PROMPT = `Sen profesyonel bir futbol antrenör asistanısın. Türkçe konuşuyorsun.

Görevin:
- Kısa, net, pratik tavsiyeler ver
- Taktik terminolojisi kullan (presing, alan savunması, kanat oyunu vb.)
- Maximum 3-4 cümle
- Emoji kullan (⚡🎯⚠️)
- "Bence" yerine "Önerim:" ile başlat
- Saha kenarındaki antrenör gibi düşün — hızlı karar verilmeli`

export interface MatchContext {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  minute: number
  formation: string
  fatiguedPlayerNames?: string[]
}

export function buildMatchContext(ctx: MatchContext): string {
  const fatigueLine = ctx.fatiguedPlayerNames?.length
    ? `\n- Yorgun oyuncular: ${ctx.fatiguedPlayerNames.join(', ')}`
    : ''

  return `${COACH_BASE_PROMPT}

Mevcut Maç Bağlamı:
- Skor: ${ctx.homeTeam} ${ctx.homeScore}-${ctx.awayScore} ${ctx.awayTeam}
- Dakika: ${ctx.minute}
- Formasyon: ${ctx.formation}${fatigueLine}`
}
