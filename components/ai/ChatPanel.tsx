'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MatchContext } from '@/lib/ai/prompts'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  /** Maç bağlamı varsa AI'ya otomatik gönderilir. */
  context?: MatchContext
  /** Hızlı soru önerileri. */
  suggestions?: string[]
  className?: string
}

const DEFAULT_SUGGESTIONS = [
  'Şu an taktiksel olarak ne yapmalıyım?',
  'Hangi oyuncuyu değiştirmemi önerirsin?',
  'Rakip baskı kuruyor, formasyonu değiştirmeli miyim?',
  'Devre arasında ne konuşmalıyım?',
]

export function ChatPanel({ context, suggestions = DEFAULT_SUGGESTIONS, className }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // Yeni mesaj geldiğinde aşağı kaydır
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const send = async (content: string) => {
    if (!content.trim() || loading) return

    const userMessage: ChatMessage = { role: 'user', content: content.trim() }
    const next = [...messages, userMessage]
    setMessages(next)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI cevap veremedi')
      setMessages((m) => [...m, { role: 'assistant', content: data.text }])
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  return (
    <div className={cn('flex h-full flex-col rounded-lg border border-border bg-card', className)}>
      {/* Başlık */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="text-sm font-semibold">AI Koç</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {context ? 'Maç bağlamı aktif' : 'Genel sohbet'}
            </div>
          </div>
        </div>
      </div>

      {/* Mesajlar */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Soru sorun ya da aşağıdaki önerilerden birini seçin:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={loading}
                  className="rounded-md border border-border bg-surface px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} message={m} />)
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            AI Koç düşünüyor…
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Giriş */}
      <form onSubmit={handleSubmit} className="border-t border-border p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Maça dair bir şey sor…"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary/15 text-foreground'
            : 'border border-border bg-surface text-foreground',
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
