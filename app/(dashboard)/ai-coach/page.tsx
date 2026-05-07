import { ChatPanel } from '@/components/ai/ChatPanel'

export const metadata = {
  title: 'AI Koç',
}

const SUGGESTIONS = [
  'Genç oyuncuları nasıl geliştiririm?',
  'Yüksek baskı kuran takıma karşı nasıl kurulurum?',
  '4-3-3 mu, 4-2-3-1 mi daha verimli?',
  'Set-piece çalışmasında nelere dikkat etmeliyim?',
]

export default function AICoachPage() {
  return (
    <div className="container flex h-[calc(100vh-4rem)] flex-col gap-4 py-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">AI Koç</h1>
        <p className="text-sm text-muted-foreground">
          Genel taktik soruları için Claude API destekli Türkçe sohbet.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ChatPanel suggestions={SUGGESTIONS} className="h-full" />
      </div>
    </div>
  )
}
