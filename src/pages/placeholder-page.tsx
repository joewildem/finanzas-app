import { ConstructionIcon } from '@hugeicons/core-free-icons'

import { EmptyState } from '@/components/empty-state'
import { Card, CardContent } from '@/components/ui/card'

// Placeholder genérico para las secciones de navegación que todavía no tienen módulo construido.
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-medium text-foreground">{title}</h1>
      <Card>
        <CardContent className="flex min-h-64 flex-col">
          <EmptyState
            icon={ConstructionIcon}
            title={`${title} is under construction`}
            description="This module isn't available yet."
          />
        </CardContent>
      </Card>
    </div>
  )
}
