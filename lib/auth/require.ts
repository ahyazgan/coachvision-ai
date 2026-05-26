/**
 * API rotaları için auth checkpoint.
 *
 * `requireSession()` — NextAuth oturumu varsa session döner, yoksa
 *   `NextResponse(401)` döner. Rota şu pattern'i kullanmalı:
 *
 *     const guard = await requireSession()
 *     if (guard instanceof NextResponse) return guard
 *     // ... session = guard
 *
 * Ortam değişkeni `AUTH_REQUIRED=true` ise check aktif. Geliştirmede default
 * olarak kapalı — login akışı tamamlanmadığı için tüm endpoint'leri
 * kilitlemek dev workflow'unu kırar. Üretim deploy'da `AUTH_REQUIRED=true`
 * ayarlanır.
 */
import { NextResponse } from 'next/server'
import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth/auth'

const AUTH_ENABLED = process.env.AUTH_REQUIRED === 'true'

export async function requireSession(): Promise<Session | NextResponse> {
  if (!AUTH_ENABLED) {
    // Dev modu: oturum varsa onu, yoksa "anonim" placeholder
    const session = await getServerSession(authOptions)
    return (
      session ??
      ({
        user: { id: 'anon', name: 'anon', email: 'anon@local', role: 'head_coach' },
        expires: '9999-12-31T23:59:59Z',
      } as Session)
    )
  }
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Yetkisiz — önce giriş yapın' },
      { status: 401 },
    )
  }
  return session
}
