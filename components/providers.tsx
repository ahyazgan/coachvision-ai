'use client'

import { SessionProvider } from 'next-auth/react'

/**
 * İstemci tarafı sağlayıcılarını sarar (oturum, tema, vb.).
 * Yeni bir global provider eklendiğinde buraya konur.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
