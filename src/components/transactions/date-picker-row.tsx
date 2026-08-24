import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Calendar01Icon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'

import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Fila "selection-card" para Date — el trigger conserva el mismo lenguaje visual que Category/
// Account (ícono + etiqueta a la izquierda, valor a la derecha); el panel ahora es el Calendar de
// shadcn/ui en vez del `<input type="date">` nativo superpuesto.
export function DatePickerRow({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  const [open, setOpen] = useState(false)

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
            <HugeiconsIcon icon={Calendar01Icon} className="size-4.5" />
          </span>
          <span className="text-sm font-medium text-foreground">Date</span>
        </span>
        <span className="text-sm text-foreground">{format(value, 'd MMM yyyy')}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-fit p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            if (date) {
              onChange(date)
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
