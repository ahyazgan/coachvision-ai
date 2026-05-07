import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { SidebarNav } from './sidebar-nav'

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <Link
        href="/"
        className="flex h-16 items-center gap-2 border-b border-border px-5 hover:bg-accent/5"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/15">
          <Trophy className="h-5 w-5 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="font-display text-lg font-bold tracking-wide">CoachVision</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            v0.1 · MVP
          </div>
        </div>
      </Link>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <div className="border-t border-border p-3 font-mono text-[11px] text-muted-foreground">
        Sezon 2025/26
      </div>
    </aside>
  )
}
