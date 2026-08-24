import { HugeiconsIcon } from '@hugeicons/react'

import { Label } from '@/components/ui/label'
import { CATEGORY_ICON_CATALOG } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

// RN-029 — catálogo cerrado de íconos (no hex libre como ColorPicker, ya que aquí no hay
// escape hatch de "ícono personalizado"). Mismo lenguaje visual que ColorPicker: grid de círculos
// con anillo de selección.
export function CategoryIconPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Icon</Label>
      <div className="grid w-fit grid-cols-8 gap-2">
        {CATEGORY_ICON_CATALOG.map((entry) => (
          <button
            key={entry.key}
            type="button"
            aria-label={entry.label}
            title={entry.label}
            onClick={() => onChange(entry.key)}
            className={cn(
              'flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/10',
              value === entry.key &&
                'bg-foreground text-background ring-2 ring-foreground ring-offset-2 ring-offset-background',
            )}
          >
            <HugeiconsIcon icon={entry.icon} className="size-4" strokeWidth={2} />
          </button>
        ))}
      </div>
    </div>
  )
}
