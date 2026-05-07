import { Trophy } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-2xl font-bold tracking-wide">CoachVision AI</div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Antrenör asistanı
          </div>
        </div>
      </Link>
      {children}
    </div>
  )
}
