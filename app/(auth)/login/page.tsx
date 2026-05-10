import { redirect } from 'next/navigation'

// Geliştirme modunda auth devre dışı — direkt panoya yönlendir.
export default function LoginPage() {
  redirect('/')
}
