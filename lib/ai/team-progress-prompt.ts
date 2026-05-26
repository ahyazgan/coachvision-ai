/**
 * Çoklu-maç gelişim raporu prompt'ları.
 *
 * Bu rapor BİLGİ SUNUMU yapar; karar VERMEZ. Antrenörü yönlendirmek değil,
 * gözlemleri ortaya koymak amacı. "Şunu yapmalısın" yerine "şu görülüyor",
 * "şu dikkat edilebilir" tonu zorlanıyor.
 */
import type { MatchProgress } from '@/lib/team-progress'

export const TEAM_PROGRESS_SYSTEM_PROMPT = `Sen profesyonel bir futbol analiz asistanısın. Türkçe konuşuyorsun.

GÖREVİN:
- Antrenöre maçlar arasındaki eğilimi bilgi olarak sun
- Karar VERME, emir VERME, "şunu yapmalısın" deme
- "Şu görülüyor", "şu dikkat edilebilir", "şu eğilim var" gibi ifadeler kullan
- Yalnızca verilen metriklere dayan; varsayım üretme
- Maksimum 5 cümle
- Sayısal değişimleri net belirt (örn. "kompaktlık 28m'den 22m'ye indi")
- 1 vurgu ile bitir: dikkat edilebilecek nokta`

/**
 * Maç-bazlı metrikleri Claude'a okutulabilir liste haline getirir.
 *
 * Sıralama eski → yeni. Liste içi her satır tek maç. Sahiplenme yoksa "-".
 */
export function buildTeamProgressUserPrompt(
  teamName: string,
  matches: MatchProgress[],
): string {
  if (matches.length < 2) {
    throw new Error('Trend için en az 2 maç gerekli')
  }

  const lines = matches.map((m, i) => {
    const date = m.date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
    })
    const score =
      m.homeScore != null && m.awayScore != null
        ? `${m.homeScore}-${m.awayScore}`
        : '—'
    const poss =
      m.possessionA != null ? `%${Math.round(m.possessionA * 100)}` : '—'

    return (
      `${i + 1}. ${date} vs ${m.opponentName} (${score}): ` +
      `kompaktlık ${m.avgCompactnessA.toFixed(0)}m, ` +
      `pres ${Math.round(m.avgPressureScore)}/100, ` +
      `sahiplenme ${poss}`
    )
  })

  return [
    `Takım: ${teamName}`,
    `Son ${matches.length} maç (eski → yeni):`,
    ...lines,
    '',
    'Bu verilere göre takımın eğilimini gözlemle. Belirgin bir değişim varsa rakamla vurgula. Antrenörün dikkat edebileceği 1 noktayı sonda belirt.',
  ].join('\n')
}
