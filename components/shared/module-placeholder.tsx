import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Construction } from 'lucide-react'

interface ModulePlaceholderProps {
  title: string
  description: string
  phase?: string
}

export function ModulePlaceholder({ title, description, phase }: ModulePlaceholderProps) {
  return (
    <div className="container space-y-6 py-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/10">
            <Construction className="h-5 w-5 text-warning" />
          </div>
          <div>
            <CardTitle className="text-xl">Modül yapım aşamasında</CardTitle>
            <CardDescription>{phase ?? 'Yol haritası bkz. PROJECT_BRIEF.md'}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Bu modül henüz boş bir iskelettir. Geliştirme sırası geldiğinde burası asıl içerikle
            doldurulacak.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
