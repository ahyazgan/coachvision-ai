import Link from 'next/link'
import { ArrowLeft, PlusCircle } from 'lucide-react'
import { NewMatchForm } from '@/components/match/NewMatchForm'

export default function NewMatchPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <Link
        href="/match"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Maçlar
      </Link>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="font-display text-2xl font-bold tracking-tight">Yeni Maç</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Rakip + tarih yeter — sonra plan kurmaya yönlendiriliriz.
        </p>
      </header>

      <NewMatchForm />
    </div>
  )
}
