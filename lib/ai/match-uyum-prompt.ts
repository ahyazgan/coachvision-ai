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
- Sonda 1 satır vurgu: "Bir sonraki maça hazırlıkta dikkat edilebilir" tarzı`

/**
 * Compliance metnini Claude'a giden user mesajına dönüştürür.
 * complianceToPromptText'in çıktısı doğrudan buraya geçer.
 */
export function buildMatchUyumUserPrompt(complianceText: string): string {
  return [
    'Aşağıdaki veri, antrenörün maç öncesi kurguladığı plana göre canlı tespit edilen sapmaların özetidir.',
    '',
    complianceText,
    '',
    'Bu veriyi maç sonu raporu olarak özetle. Antrenöre plana uyum hakkında gözlem niteliğinde bilgi sun.',
  ].join('\n')
}
