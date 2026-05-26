/**
 * Maç sonu plan-uyum hesabı.
 *
 * DB'deki MatchEvent satırlarını (finish endpoint'inin yazdığı `command:*` ve
 * `live:*` tipler) okuyup özet metrikler üretir:
 *  - Her severity (RISK/WARN/OPPORTUNITY) için toplam komut sayısı
 *  - Her kural için ihlal sayısı + ilk/son dakika
 *  - Plana uyum yüzdesi (zaman ağırlıklı)
 *  - Olay (possession_switch, high_pressure) sayısı
 *
 * Uyum yüzdesi heuristic'i: oturum dakikası başına ortalama komut sayısı
 * baseline'ı (örn. dakikada 0.5 komut = orta, 1+ = düşük uyum). Şu an basit
 * formül; ileride plana göre normalize edilir.
 */
import type { Prisma } from '@prisma/client'

export type Severity = 'RISK' | 'WARN' | 'OPPORTUNITY'

export interface RuleStats {
  ruleId: string
  count: number
  firstMinute: number
  lastMinute: number
  severity: Severity
  exampleText: string
}

export interface MatchCompliance {
  totalMinutes: number // maçın işlenen dakika sayısı (yaklaşık)
  totalCommands: number
  bySeverity: Record<Severity, number>
  rules: RuleStats[]
  liveEventCount: number
  liveEventBreakdown: Record<string, number>
  // 0-100; yüksek = plana yakın, düşük = sapma çok
  complianceScore: number
  // İnsan-okunur yorum (Claude'a girdi olarak verilir, UI'da da gösterilir)
  summaryHints: string[]
}

interface MatchEventRow {
  type: string
  minute: number
  details: Prisma.JsonValue | null
}

/**
 * MatchEvent satırlarından plan-uyum istatistiklerini çıkarır.
 * Saf hesaplama — Claude'a girmez, deterministik.
 */
export function computeCompliance(
  events: MatchEventRow[],
  matchDurationMinutes: number,
): MatchCompliance {
  const bySeverity: Record<Severity, number> = { RISK: 0, WARN: 0, OPPORTUNITY: 0 }
  const ruleAcc = new Map<string, RuleStats>()
  const liveBreakdown = new Map<string, number>()
  let liveTotal = 0
  let totalCommands = 0

  for (const e of events) {
    if (e.type.startsWith('command:')) {
      totalCommands++
      const ruleId = e.type.slice('command:'.length)
      const d = (e.details ?? {}) as Record<string, unknown>
      const severity = (d.severity as Severity | undefined) ?? 'WARN'
      const text = typeof d.text === 'string' ? d.text : ''

      bySeverity[severity]++

      const acc = ruleAcc.get(ruleId)
      if (acc) {
        acc.count++
        acc.firstMinute = Math.min(acc.firstMinute, e.minute)
        acc.lastMinute = Math.max(acc.lastMinute, e.minute)
      } else {
        ruleAcc.set(ruleId, {
          ruleId,
          count: 1,
          firstMinute: e.minute,
          lastMinute: e.minute,
          severity,
          exampleText: text,
        })
      }
    } else if (e.type.startsWith('live:')) {
      liveTotal++
      const t = e.type.slice('live:'.length)
      liveBreakdown.set(t, (liveBreakdown.get(t) ?? 0) + 1)
    }
  }

  const totalMinutes = Math.max(1, matchDurationMinutes)
  // Heuristic uyum skoru: RISK ihlali 4 puan, WARN 2, OPPORTUNITY 0 (fırsat ceza
  // değil). Dakika başına ortalama "ceza" → 100'den düş.
  const penaltyPerMinute =
    (bySeverity.RISK * 4 + bySeverity.WARN * 2) / totalMinutes
  // 0 ceza = 100, dakikada 5 puan ceza = 0
  const complianceScore = Math.max(
    0,
    Math.min(100, Math.round(100 - penaltyPerMinute * 20)),
  )

  const rules = Array.from(ruleAcc.values()).sort((a, b) => b.count - a.count)

  const summaryHints: string[] = []
  if (bySeverity.RISK > 0) {
    summaryHints.push(`${bySeverity.RISK} kez RİSK uyarısı tetiklendi.`)
  }
  if (bySeverity.WARN > 0) {
    summaryHints.push(`${bySeverity.WARN} kez DİKKAT uyarısı.`)
  }
  if (bySeverity.OPPORTUNITY > 0) {
    summaryHints.push(`${bySeverity.OPPORTUNITY} FIRSAT tespit edildi.`)
  }
  if (rules.length > 0) {
    const top = rules[0]!
    summaryHints.push(
      `En sık ihlal: ${top.ruleId} (${top.count} kez, ${top.firstMinute}-${top.lastMinute}' arası).`,
    )
  }

  return {
    totalMinutes,
    totalCommands,
    bySeverity,
    rules,
    liveEventCount: liveTotal,
    liveEventBreakdown: Object.fromEntries(liveBreakdown),
    complianceScore,
    summaryHints,
  }
}

/**
 * Compliance objesini Claude'a okutulabilir Türkçe metne çevirir.
 * Prompt'un user mesajında kullanılır.
 */
export function complianceToPromptText(c: MatchCompliance, planName: string): string {
  const lines: string[] = [
    `Plan: ${planName}`,
    `İşlenen süre: ~${c.totalMinutes} dakika`,
    `Plana uyum skoru: ${c.complianceScore}/100`,
    `Toplam uyarı: ${c.totalCommands} (RİSK: ${c.bySeverity.RISK}, DİKKAT: ${c.bySeverity.WARN}, FIRSAT: ${c.bySeverity.OPPORTUNITY})`,
    '',
    'En sık tetiklenen ihlaller:',
  ]
  if (c.rules.length === 0) {
    lines.push('- Hiç ihlal yok')
  } else {
    for (const r of c.rules.slice(0, 5)) {
      lines.push(
        `- ${r.ruleId} (${r.severity}): ${r.count} kez, ${r.firstMinute}-${r.lastMinute}' arası — "${r.exampleText}"`,
      )
    }
  }
  if (c.liveEventCount > 0) {
    lines.push('', `Canlı olaylar: ${c.liveEventCount} toplam`)
    for (const [t, n] of Object.entries(c.liveEventBreakdown)) {
      lines.push(`- ${t}: ${n}`)
    }
  }
  return lines.join('\n')
}
