import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// CU-035 — "Editar nota". Sobrescribe la nota de todas las seleccionadas con el mismo texto
// (RN-110, no concatena con la nota existente de cada una) — a diferencia de "Cambiar cuenta"/
// "Cambiar fecha", captura texto libre, así que sí necesita un botón "Apply" explícito.
export function BatchEditNotePopover({
  disabled,
  onConfirm,
}: {
  disabled: boolean
  onConfirm: (nota: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setDraft('')
      }}
    >
      <PopoverTrigger render={<Button type="button" variant="outline" size="sm" disabled={disabled} />}>
        Edit note
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            setOpen(false)
            onConfirm(draft)
          }}
          className="flex flex-col gap-2"
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={140}
            placeholder="New note for all selected"
            autoFocus
          />
          <Button type="submit" size="sm">
            Apply
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
