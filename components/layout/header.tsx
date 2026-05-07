'use client'

import { useSession, signOut } from 'next-auth/react'
import { Bell, LogOut, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Header() {
  const { data: session } = useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? 'Misafir'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-2 w-2 animate-pulse-glow rounded-full bg-success" aria-hidden />
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Sistem Aktif
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Bildirimler">
          <Bell className="h-4 w-4" />
        </Button>

        <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 sm:flex">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{userName}</span>
        </div>

        {session && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: '/login' })}
            aria-label="Çıkış"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  )
}
