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
  örn. "yüksek pres + 4-3-3 planınızda hat açılması özellikle tehlikelidir"
- Eğer oyuncu görev atamaları verildiyse ilgili oyuncuyu adıyla referansla:
  örn. "Hakan'a verdiğiniz box-to-box rolü orta sahanın açılmasına katkı sağlamış olabilir"`

/**
 * Tek bir görev atamasının insan-okunur özeti — Claude'a giden satır.
 * Doldurulmuş atamalar prompt'a girer; player_id veya role boş olanlar atlanır.
 */
export interface PlanAssignmentSummary {
  position: string // "GK" | "DF" | "MF" | "FW" (jenerik) veya spesifik
  role: string
  playerLabel: string // "#10 Hakan Çalhanoğlu" tarzı
}

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
  /** Doldurulmuş oyuncu görev atamaları (boş slot'lar dahil değil). */
  assignments?: PlanAssignmentSummary[]
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
 * Genel parametreler tek satırda, oyuncu görev atamaları (varsa) ayrı blokta.
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
  const general = lines.join(' · ')

  if (!ctx.assignments || ctx.assignments.length === 0) {
    return general
  }

  // Doldurulmuş oyuncu atamaları — pozisyon-sıralı liste
  const assignmentLines = ctx.assignments.map(
    (a) => `- ${a.playerLabel} (${a.position}): ${a.role}`,
  )
  return [general, '', 'Oyuncu görevleri:', ...assignmentLines].join('\n')
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
