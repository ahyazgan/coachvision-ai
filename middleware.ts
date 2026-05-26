/**
 * Next.js middleware — /api/* için IP-bazlı rate limit.
 *
 * In-memory token bucket: her IP için dakikada `LIMIT` istek hakkı.
 * Cold start sonrası ilk yarım saniyede patlayan sentetik trafik için kullanışlı.
 *
 * Üretimde Redis/Upstash gibi paylaşımlı store gerekir; bu sadece tek-instance
 * MVP için yeterli. Çoklu instance'da her replica'nın kendi sayacı olur.
 *
 * Yükleme endpoint'i (`/api/video/upload`) için daha gevşek limit (büyük dosya
 * upload bir kez gelir, paralel olarak değil).
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface Bucket {
  count: number
  windowStart: number
}

// Global Map (Next.js dev hot-reload arası kaybolabilir; üretimde önemsiz çünkü
// pencere zaten 60s).
const buckets = new Map<string, Bucket>()

const WINDOW_MS = 60_000
const DEFAULT_LIMIT = Number(process.env.RATE_LIMIT_PER_MIN ?? 120)
const UPLOAD_LIMIT = 10

function clientIp(req: NextRequest): string {
  const xf = req.headers.get('x-forwarded-for')
  if (xf) return xf.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // NextAuth callback'leri kendi mantığına sahip — rate limit'ten muaf
  if (pathname.startsWith('/api/auth/')) return NextResponse.next()

  const ip = clientIp(req)
  const limit = pathname.startsWith('/api/video/upload') ? UPLOAD_LIMIT : DEFAULT_LIMIT
  const now = Date.now()
  const key = `${ip}:${pathname.startsWith('/api/video/upload') ? 'upload' : 'std'}`

  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now })
    return NextResponse.next()
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return NextResponse.json(
      { error: 'Çok fazla istek — bir dakika sonra tekrar deneyin' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((WINDOW_MS - (now - bucket.windowStart)) / 1000).toString(),
        },
      },
    )
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
