import Link from 'next/link'
import {
  Calendar,
  ClipboardList,
  FileVideo,
  ListChecks,
  PlusCircle,
  Radio,
  Swords,
} from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import { prisma } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export default async function MatchListPage() {
  const matches = await prisma.match.findMany({
    orderBy: { date: 'desc' },
    take: 50,
    include: {
      plan: { select: { id: true } },
      _count: { select: { events: true, videos: true } },
    },
  })

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" aria-hidden />
            <h1 className="font-display text-2xl font-bold tracking-tight">Maçlar</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Tüm maçların listesi — plan, canlı yayın, uyum raporu ve video analizine buradan ulaş.
          </p>
        </div>
        <Link
          href="/match/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <PlusCircle className="h-4 w-4" aria-hidden /> Yeni Maç
        </Link>
      </header>

      {matches.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={{
                id: m.id,
                opponentName: m.awayTeamName,
                date: m.date,
                homeScore: m.homeScore,
                awayScore: m.awayScore,
                status: m.status,
                competition: m.competition,
                hasPlan: m.plan !== null,
                eventCount: m._count.events,
                videoCount: m._count.videos,
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

interface MatchRowData {
  id: string
  opponentName: string
  date: Date
  homeScore: number | null
  awayScore: number | null
  status: string
  competition: string
  hasPlan: boolean
  eventCount: number
  videoCount: number
}

function MatchRow({ match: m }: { match: MatchRowData }) {
  const hasUyum = m.eventCount > 0
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-display text-base font-semibold">vs {m.opponentName}</span>
            <StatusBadge status={m.status} />
            {m.homeScore != null && m.awayScore != null && (
              <span className="font-mono text-sm text-muted-foreground tabular-nums">
                {m.homeScore}-{m.awayScore}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden />
              {format(m.date, 'd MMMM yyyy', { locale: tr })}
            </span>
            <span className="font-mono">{m.competition}</span>
            <span className="font-mono">
              {m.videoCount > 0 && `${m.videoCount} video · `}
              {m.eventCount > 0 && `${m.eventCount} olay`}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <ActionLink
            href={`/match/${m.id}/plan`}
            icon={<ClipboardList className="h-3 w-3" aria-hidden />}
            label="Plan"
            active={m.hasPlan}
          />
          <ActionLink
            href={`/live?match=${m.id}`}
            icon={<Radio className="h-3 w-3" aria-hidden />}
            label="Canlı"
            active={m.hasPlan}
          />
          <ActionLink
            href={`/match/${m.id}/uyum`}
            icon={<ListChecks className="h-3 w-3" aria-hidden />}
            label="Uyum"
            active={hasUyum}
          />
        </div>
      </div>
    </li>
  )
}

function ActionLink({
  href,
  icon,
  label,
  active,
}: {
  href: string
  icon: React.ReactNode
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/15'
          : 'inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground'
      }
    >
      {icon}
      {label}
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    scheduled: { label: 'Bekliyor', className: 'bg-muted text-muted-foreground' },
    live: { label: 'Canlı', className: 'bg-destructive/15 text-destructive' },
    completed: { label: 'Tamamlandı', className: 'bg-success/15 text-success' },
  }
  const v = map[status] ?? map.scheduled!
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${v.className}`}
    >
      {v.label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Henüz maç eklenmemiş. Yeni bir maç oluşturup plan kurmaya başla.
      </p>
      <Link
        href="/match/new"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
      >
        <PlusCircle className="h-3 w-3" aria-hidden /> Yeni Maç
      </Link>
      <p className="mt-4 text-xs text-muted-foreground">
        Veya direkt{' '}
        <Link href="/video/upload" className="text-primary hover:underline">
          <FileVideo className="inline h-3 w-3" aria-hidden /> video yükle
        </Link>
        {' '}— otomatik bir maç oluşturulur.
      </p>
    </div>
  )
}
