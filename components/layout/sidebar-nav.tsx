'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Video,
  Radio,
  ClipboardList,
  Users,
  BarChart3,
  Dumbbell,
  Swords,
  Search,
  HeartPulse,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { href: '/', label: 'Pano', icon: LayoutDashboard },
  { href: '/video', label: 'Video Analizi', icon: Video },
  { href: '/live', label: 'Canlı Maç', icon: Radio },
  { href: '/tactics', label: 'Taktik Tahtası', icon: ClipboardList },
  { href: '/squad', label: 'Kadro', icon: Users },
  { href: '/analysis', label: 'Maç Analizi', icon: BarChart3 },
  { href: '/training', label: 'Antrenman', icon: Dumbbell },
  { href: '/opponent', label: 'Rakip Analizi', icon: Swords },
  { href: '/scout', label: 'Scout', icon: Search },
  { href: '/health', label: 'Sağlık', icon: HeartPulse },
  { href: '/ai-coach', label: 'AI Koç', icon: Sparkles },
  { href: '/admin', label: 'Yönetim', icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'min-h-[44px]',
              isActive
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
