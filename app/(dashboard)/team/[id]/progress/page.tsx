import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, FileVideo, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { ProgressTimeline } from '@/components/team/ProgressTimeline'
import { ProgressReportCard } from '@/components/team/ProgressReportCard'
import { getTeamProgress } from '@/lib/team-progress'

// recharts ResponsiveContainer + server prerender uyumsuz; dynamic'e zorla
export const dynamic = 'force-dynamic'

interface PageProps {
  params: { id: string }
  searchParams: { n?: string }
}

const ALLOWED_LIMITS = [3, 5, 10] as const

function parseLimit(raw: string | undefined): number {
  const n = Number(raw)
  return ALLOWED_LIMITS.includes(n as (typeof ALLOWED_LIMITS)[number]) ? n : 5
}

export default async function TeamProgressPage({ params, searchParams }: PageProps) {
  const limit = parseLimit(searchParams.n)
  const progress = await getTeamProgress(params.id, limit)
  if (progress === null) notFound()

  const enoughMatches = progress.matches.length >= 2

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <Link
        href="/squad"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Geri
      </Link>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {progress.teamName} — Gelişim
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Son {progress.matches.length} analiz edilmiş maç. Antrenöre gözlem
          sunar; karar verici değildir.
        </p>

        <LimitSelector teamId={params.id} current={limit} />
      </header>

      {progress.matches.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <MatchList matches={progress.matches} />
          <ProgressTimeline matches={progress.matches} />
          <ProgressReportCard
            teamId={params.id}
            limit={limit}
            enoughMatches={enoughMatches}
          />
        </>
      )}
    </div>
  )
}

function LimitSelector({ teamId, current }: { teamId: string; current: number }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">Maç sayısı:</span>
      {ALLOWED_LIMITS.map((n) => (
        <Link
          key={n}
          href={`/team/${teamId}/progress?n=${n}`}
          className={
            n === current
              ? 'rounded-md bg-primary px-2 py-0.5 font-mono font-medium text-primary-foreground'
              : 'rounded-md px-2 py-0.5 font-mono text-muted-foreground hover:text-foreground'
          }
        >
          {n}
        </Link>
      ))}
    </div>
  )
}

function MatchList({
  matches,
}: {
  matches: Awaited<ReturnType<typeof getTeamProgress>> extends infer T
    ? T extends { matches: infer M }
      ? M
      : never
    : never
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {matches.map((m) => (
        <li
          key={m.matchId}
          className="rounded-lg border border-border bg-card p-3 text-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-display font-semibold">vs {m.opponentName}</span>
            {m.homeScore != null && m.awayScore != null && (
              <span className="font-mono text-xs text-muted-foreground">
                {m.homeScore}-{m.awayScore}
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" aria-hidden />
            {format(m.date, 'd MMMM yyyy', { locale: tr })}
            <span className="ml-auto flex items-center gap-1 font-mono">
              <FileVideo className="h-3 w-3" aria-hidden />
              {m.framesAnalyzed}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Bu takım için henüz analiz edilmiş maç yok.
      </p>
      <Link
        href="/video/upload"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        İlk video analizini yükle
      </Link>
    </div>
  )
}
