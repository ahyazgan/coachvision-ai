import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'

const providers: NextAuthOptions['providers'] = [
  // Geliştirme için basit kimlik bilgisi sağlayıcısı.
  // Üretimde kaldır veya bcrypt + DB doğrulaması ekle.
  CredentialsProvider({
    id: 'credentials',
    name: 'E-posta',
    credentials: {
      email: { label: 'E-posta', type: 'email' },
      password: { label: 'Şifre', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email) return null
      // TODO: gerçek doğrulama — Player modülünden sonra
      return {
        id: 'dev-user',
        email: credentials.email,
        name: credentials.email.split('@')[0],
        role: 'head_coach',
      }
    },
  }),
]

// Google OAuth sadece env değişkenleri varsa eklenir.
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'head_coach'
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
}
