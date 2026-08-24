import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ChevronRightIcon, Shapes01Icon } from '@hugeicons/core-free-icons'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { CategoryGroupWithChildren } from '@/hooks/use-category-groups'
import { getCategoryIcon } from '@/lib/category-icons'
import { cn } from '@/lib/utils'

// Fila "selection-card" para Category — a diferencia de Account, el panel agrupa las opciones por
// grupo de categoría (encabezado en mayúsculas) y muestra el ícono de cada categoría junto a su
// nombre, en vez de una cuadrícula (aquí el nombre sí importa para elegir bien).
export function CategoryPickerRow({
  groups,
  categoryId,
  onSelect,
}: {
  groups: CategoryGroupWithChildren[]
  categoryId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)

  const selected = groups.flatMap((entry) => entry.categories).find((c) => c.id === categoryId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-left transition-colors hover:bg-muted/70"
          />
        }
      >
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground">
            <HugeiconsIcon icon={selected ? getCategoryIcon(selected.icono) : Shapes01Icon} className="size-4.5" />
          </span>
          <span className="text-sm font-medium text-foreground">Category</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn('text-sm', selected ? 'text-foreground' : 'text-muted-foreground')}>
            {selected?.nombre ?? 'Select'}
          </span>
          <HugeiconsIcon icon={ChevronRightIcon} className="size-4 text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-(--anchor-width) overflow-y-auto p-1">
        {groups.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Nothing to choose from yet.</p>
        ) : (
          groups.map((entry) => (
            <div key={entry.group.id}>
              <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {entry.group.nombre}
              </p>
              {entry.categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    onSelect(category.id)
                    setOpen(false)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <HugeiconsIcon icon={getCategoryIcon(category.icono)} className="size-4 text-muted-foreground" />
                  {category.nombre}
                </button>
              ))}
            </div>
          ))
        )}
      </PopoverContent>
    </Popover>
  )
}
