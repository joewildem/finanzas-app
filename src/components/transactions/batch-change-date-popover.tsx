import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// CU-035 — "Cambiar fecha". Sobrescribe la fecha de todas las seleccionadas con el mismo valor
// (RN-109, no es un corrimiento relativo) — elegir un día en el Calendar confirma de inmediato.
export function BatchChangeDatePopover({
  disabled,
  onConfirm,
}: {
  disabled: boolean
  onConfirm: (fecha: Date) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
        Change date
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit p-0">
        <Calendar
          mode="single"
          onSelect={(date) => {
            if (date) {
              setOpen(false)
              onConfirm(date)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
