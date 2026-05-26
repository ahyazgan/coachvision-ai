import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ListChecks,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { prisma } from '@/lib/db/client'
import { computeCompliance, type Severity } from '@/lib/match-compliance'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
}

async function fetchReport(matchId: string, baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/match/${matchId}/uyum`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as {
    matchId: string
    opponentName: string
    planName: string
    status: string
    compliance: ReturnType<typeof computeCompliance>
    aiReport: string | null
    aiError: string | null
  }
}

export default async function MatchUyumPage({ params }: PageProps) {
  const match = await prisma.match.findUnique({
    where: { id: params.id },
    select: { id: true, awayTeamName: true },
  })
  if (!match) notFound()

  // Server-side fetch: Claude raporu burada üretilir (cache'siz)
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const report = await fetchReport(params.id, baseUrl)

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <BackLink matchId={params.id} />
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Rapor üretilemedi. Maç tamamlandı mı kontrol et.
        </div>
      </div>
    )
  }

  const { compliance, aiReport, aiError } = report

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <BackLink matchId={params.id} />

      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Plan-Uyum Raporu — vs {report.opponentName}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Plan: <span className="font-medium">{report.planName}</span> ·
          {' '}Maç durumu: <span className="font-medium">{report.status}</span>
        </p>
      </header>

      <ComplianceScore score={compliance.complianceScore} />

      <SeverityGrid bySeverity={compliance.bySeverity} />

      <AIReportCard report={aiReport} error={aiError} />

      <RuleBreakdown rules={compliance.rules} />

      <LiveEventsCard breakdown={compliance.liveEventBreakdown} total={compliance.liveEventCount} />
    </div>
  )
}

function BackLink({ matchId }: { matchId: string }) {
  return (
    <Link
      href={`/match/${matchId}/plan`}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden /> Plana dön
    </Link>
  )
}

function ComplianceScore({ score }: { score: number }) {
  const label = score >= 80 ? 'Yüksek uyum' : score >= 50 ? 'Orta uyum' : 'Düşük uyum'
  const color =
    score >= 80
      ? 'text-success border-success/40 bg-success/10'
      : score >= 50
        ? 'text-warning border-warning/40 bg-warning/10'
        : 'text-destructive border-destructive/40 bg-destructive/10'
  return (
    <div className={`flex items-center gap-4 rounded-lg border-2 p-5 ${color}`}>
      <TrendingUp className="h-8 w-8" aria-hidden />
      <div className="flex-1">
        <div className="font-display text-3xl font-bold tabular-nums">{score}/100</div>
        <div className="text-sm font-medium">{label}</div>
      </div>
      <p className="max-w-xs text-xs text-muted-foreground">
        Skor: dakikada tetiklenen RİSK + DİKKAT uyarılarına dayalı heuristic.
        Plana ne kadar yakın oynandığı hakkında genel bir gösterge.
      </p>
    </div>
  )
}

function SeverityGrid({ bySeverity }: { bySeverity: Record<Severity, number> }) {
  const items: { sev: Severity; label: string; icon: typeof ShieldAlert; cls: string }[] = [
    {
      sev: 'RISK',
      label: 'RİSK',
      icon: ShieldAlert,
      cls: 'text-destructive border-destructive/40 bg-destructive/10',
    },
    {
      sev: 'WARN',
      label: 'DİKKAT',
      icon: AlertTriangle,
      cls: 'text-warning border-warning/40 bg-warning/10',
    },
    {
      sev: 'OPPORTUNITY',
      label: 'FIRSAT',
      icon: Sparkles,
      cls: 'text-success border-success/40 bg-success/10',
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map(({ sev, label, icon: Icon, cls }) => (
        <div key={sev} className={`rounded-lg border p-4 ${cls}`}>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
          </div>
          <div className="mt-1 font-display text-3xl font-bold tabular-nums">
            {bySeverity[sev]}
          </div>
          <div className="text-xs text-muted-foreground">toplam tetiklenme</div>
        </div>
      ))}
    </div>
  )
}

function AIReportCard({ report, error }: { report: string | null; error: string | null }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-display text-base font-semibold">AI Özet (Gözlem)</h2>
      </div>
      {report ? (
        <p className="whitespace-pre-line rounded-md border border-border bg-background/40 p-3 text-sm leading-relaxed">
          {report}
        </p>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{error ?? 'Yorum üretilemedi'}</span>
        </div>
      )}
    </div>
  )
}

function RuleBreakdown({
  rules,
}: {
  rules: ReturnType<typeof computeCompliance>['rules']
}) {
  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm text-success">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Hiç plan ihlali tespit edilmedi.
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-base font-semibold">Kural Bazlı İhlal Dağılımı</h2>
      <ul className="space-y-1.5">
        {rules.map((r) => (
          <li
            key={r.ruleId}
            className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
          >
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {r.severity}
            </span>
            <span className="font-medium">{r.ruleId}</span>
            <span className="ml-auto font-mono text-sm tabular-nums">{r.count}×</span>
            <span className="font-mono text-xs text-muted-foreground">
              {r.firstMinute}-{r.lastMinute}'
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LiveEventsCard({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>
  total: number
}) {
  if (total === 0) return null
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-base font-semibold">Canlı Olaylar</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(breakdown).map(([type, n]) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 text-xs"
          >
            <span className="font-mono">{type}</span>
            <span className="font-mono font-semibold">×{n}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
