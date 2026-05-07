import type { Metadata, Viewport } from 'next'
import { Rajdhani, Exo_2, IBM_Plex_Mono, Barlow_Condensed } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const exo2 = Exo_2({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-exo2',
  weight: ['300', '400', '600', '700'],
  display: 'swap',
})

const rajdhani = Rajdhani({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-rajdhani',
  weight: ['500', '600', '700'],
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['400', '500'],
  display: 'swap',
})

const barlow = Barlow_Condensed({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-barlow',
  weight: ['600', '700', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'CoachVision AI',
    template: '%s · CoachVision AI',
  },
  description:
    'Yapay zeka destekli profesyonel futbol antrenör asistanı. Canlı analiz, taktik tahtası, oyuncu yönetimi.',
  applicationName: 'CoachVision AI',
  authors: [{ name: 'CoachVision' }],
  keywords: ['futbol', 'antrenör', 'taktik', 'AI', 'analiz'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#070b12',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="dark" suppressHydrationWarning>
      <body
        className={`${exo2.variable} ${rajdhani.variable} ${plexMono.variable} ${barlow.variable} font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
