/**
 * Maç sonu plan-uyum raporu prompt'ları.
 *
 * Karar verici değil, gözlemci tonu — antrenör için "şu oldu, dikkat çekilebilir"
 * tarzı kısa rapor. Football Manager mantığı: plan vs gerçek, sapmaları özetle.
 */

export const MATCH_UYUM_SYSTEM_PROMPT = `Sen profesyonel bir futbol analiz asistanısın. Türkçe konuşuyorsun.

GÖREVİN: Bir maç boyunca tetiklenen plan-sapma uyarılarını antrenöre özetle.

KURALLAR:
- Karar VERME, emir VERME, "şunu yapmalısın" deme
- "Plana göre şu görüldü", "şu eğilim vardı", "şu dikkat çekiyor" tonu
- 4-6 cümle, fazla uzun olma
- Rakamları net belirt (örn. "8 kez savunma açıldı, 35-50' arasında")
- Hangi kuralın baskın olduğunu vurgula
- Plana uyum skoru hakkında bir cümle yorumla
- Sonda 1 satır vurgu: "Bir sonraki maça hazırlıkta dikkat edilebilir" tarzı
- Eğer PLAN KİMLİĞİ (diziliş, talimatlar) verildiyse yorumu ona özel yap:
  örn. "yüksek pres + 4-3-3 planınızda hat açılması özellikle tehlikelidir"`

/**
 * Plan kimliği — Claude'a kontekst için.
 */
export interface PlanContext {
  formation: string
  defensiveLine: string  // "low" | "mid" | "high"
  pressing: string
  possessionStyle: string
  width: string
  tempo: string
  notes?: string
}

const READABLE_LINE: Record<string, string> = {
  low: 'düşük (geride)', mid: 'orta', high: 'yüksek (önde)',
}
const READABLE_PRESS: Record<string, string> = {
  low: 'düşük', mid: 'orta', high: 'yüksek',
}
const READABLE_POSS: Record<string, string> = {
  build_up: 'yapılandırma (oyun kurma)', balanced: 'dengeli', direct: 'direkt',
}
const READABLE_WIDTH: Record<string, string> = {
  narrow: 'dar', balanced: 'dengeli', wide: 'geniş',
}
const READABLE_TEMPO: Record<string, string> = {
  slow: 'yavaş', medium: 'orta', fast: 'hızlı',
}

/**
 * Plan kimliğini insan-okunur Türkçe metne çevirir (prompt'a girer).
 */
export function formatPlanContext(ctx: PlanContext): string {
  const lines = [
    `Diziliş: ${ctx.formation}`,
    `Defansif çizgi: ${READABLE_LINE[ctx.defensiveLine] ?? ctx.defensiveLine}`,
    `Pres yoğunluğu: ${READABLE_PRESS[ctx.pressing] ?? ctx.pressing}`,
    `Sahiplenme stili: ${READABLE_POSS[ctx.possessionStyle] ?? ctx.possessionStyle}`,
    `Genişlik: ${READABLE_WIDTH[ctx.width] ?? ctx.width}`,
    `Tempo: ${READABLE_TEMPO[ctx.tempo] ?? ctx.tempo}`,
  ]
  if (ctx.notes && ctx.notes.trim()) {
    lines.push(`Antrenör notu: ${ctx.notes.trim()}`)
  }
  return lines.join(' · ')
}

/**
 * Compliance metnini + plan kontekstini Claude'a giden user mesajına dönüştürür.
 * Plan kontekstli versiyonu: Claude formasyon + talimatları okur, yorumu plana
 * özel hale gelir ("4-3-3 + yüksek pres planınızda hat açılması özellikle
 * tehlikelidir" gibi).
 */
export function buildMatchUyumUserPrompt(
  complianceText: string,
  planContext?: PlanContext,
): string {
  const parts = [
    'Aşağıdaki veri, antrenörün maç öncesi kurguladığı plana göre canlı tespit edilen sapmaların özetidir.',
    '',
  ]
  if (planContext) {
    parts.push(
      'PLAN KİMLİĞİ (bu plana özel yorum yap, genel öneri verme):',
      formatPlanContext(planContext),
      '',
      'TESPİT EDİLEN SAPMA İSTATİSTİKLERİ:',
    )
  }
  parts.push(complianceText, '', 'Bu veriyi maç sonu raporu olarak özetle. Antrenöre plana uyum hakkında gözlem niteliğinde bilgi sun.')
  return parts.join('\n')
}
