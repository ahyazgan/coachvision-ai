/**
 * Doğrulama veri seti metrikleri.
 *
 * Her sample: elle işaretlenmiş gerçek (ground truth) konumlar + sistemin
 * (YOLO + K-means) çıktısı, hepsi normalize 0..1 uzayda. Eşleştirme greedy
 * nearest-neighbor — frame en geniş kenarının %5'i içinde kalan en yakın
 * eşleşme TP sayılır; eşleşmeyen GT FN, eşleşmeyen sistem tespiti FP.
 *
 * Team accuracy eşleşmiş çiftler içinde takım etiketi tutturma oranı.
 * Eşleşememiş "null takım" sistem çıktısı eşleşmenin team comparison'ına
 * dahil edilmez (kaleci/hakem outlier).
 */

export interface GroundTruthPoint {
  x: number // 0..1
  y: number
  team: 'A' | 'B'
}

export interface SystemPoint {
  x: number
  y: number
  team: 'A' | 'B' | null
  confidence: number
}

export interface SampleInput {
  groundTruth: GroundTruthPoint[]
  systemOutput: SystemPoint[]
}

export interface ValidationMetrics {
  sampleCount: number
  totalGroundTruth: number
  totalSystem: number
  truePositives: number
  falsePositives: number // sistem tespit ettiği ama GT'de eşi yok
  falseNegatives: number // GT'de olan ama sistem kaçırdı
  precision: number // TP / (TP + FP)
  recall: number // TP / (TP + FN)
  f1: number
  teamAccuracy: number // eşleşmiş çiftlerde takım tutturma
  teamComparable: number // takım karşılaştırması yapılan çift sayısı (null hariç)
}

/** İki normalize nokta arası Öklid mesafesi. */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Tek bir frame için TP/FP/FN + takım tutturma.
 *
 * Greedy: tüm GT-Pred çiftlerini mesafeye göre sırala, eşik altındakileri
 * sırayla eşleştir (her iki taraf bir kez kullanılabilir). Hungarian
 * olmamasının sebebi: pratik olarak yeterli, basit, hızlı.
 */
function matchSample(s: SampleInput, threshold = 0.05) {
  const pairs: Array<{ gtIdx: number; sysIdx: number; d: number }> = []
  for (let i = 0; i < s.groundTruth.length; i++) {
    for (let j = 0; j < s.systemOutput.length; j++) {
      const d = dist(s.groundTruth[i], s.systemOutput[j])
      if (d <= threshold) pairs.push({ gtIdx: i, sysIdx: j, d })
    }
  }
  pairs.sort((a, b) => a.d - b.d)

  const gtUsed = new Set<number>()
  const sysUsed = new Set<number>()
  let tp = 0
  let teamMatched = 0
  let teamComparable = 0
  for (const p of pairs) {
    if (gtUsed.has(p.gtIdx) || sysUsed.has(p.sysIdx)) continue
    gtUsed.add(p.gtIdx)
    sysUsed.add(p.sysIdx)
    tp++
    const sysTeam = s.systemOutput[p.sysIdx].team
    if (sysTeam !== null) {
      teamComparable++
      if (sysTeam === s.groundTruth[p.gtIdx].team) teamMatched++
    }
  }

  return {
    tp,
    fn: s.groundTruth.length - gtUsed.size,
    fp: s.systemOutput.length - sysUsed.size,
    teamMatched,
    teamComparable,
  }
}

export function computeValidationMetrics(samples: SampleInput[]): ValidationMetrics {
  let tp = 0
  let fp = 0
  let fn = 0
  let teamMatched = 0
  let teamComparable = 0
  let totalGT = 0
  let totalSys = 0

  for (const s of samples) {
    totalGT += s.groundTruth.length
    totalSys += s.systemOutput.length
    const m = matchSample(s)
    tp += m.tp
    fp += m.fp
    fn += m.fn
    teamMatched += m.teamMatched
    teamComparable += m.teamComparable
  }

  const precision = tp + fp === 0 ? 0 : tp / (tp + fp)
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn)
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
  const teamAccuracy = teamComparable === 0 ? 0 : teamMatched / teamComparable

  return {
    sampleCount: samples.length,
    totalGroundTruth: totalGT,
    totalSystem: totalSys,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
    teamAccuracy,
    teamComparable,
  }
}
