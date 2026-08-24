import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { findSavingsErrorCodeInMessage, type SavingsErrorCode } from '@/lib/savings-errors'
import { supabase } from '@/lib/supabase'

// CU-046 — archivar pide confirmación explícita; reactivar es el mismo cambio de status en
// reversa, sin confirmación (resuelto con un botón directo en el caller, mismo criterio que
// ArchiveCategoryDialog/ArchiveAccountDialog). Sin cascada — una meta no tiene hijos.
// `open`/`onOpenChange` son opcionales: sin ellos, el diálogo es autónomo con su propio botón
// "Archive" (uso en el detalle de la meta); con ellos, no renderiza trigger propio — quien lo usa
// (ej. el menú de acciones de la card) controla la apertura (RN mismo criterio que un Dialog
// disparado desde un DropdownMenuItem, para evitar que el cierre del menú compita con la apertura
// del diálogo).
export function ArchiveGoalDialog({
  goalId,
  onArchived,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  goalId: string
  onArchived: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<SavingsErrorCode | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)

    const { error: opError } = await supabase
      .from('savings_goals')
      .update({ status: 'archived' })
      .eq('id', goalId)
      .eq('status', 'active')

    setIsSubmitting(false)
    if (opError) {
      setError(findSavingsErrorCodeInMessage(opError.message) ?? 'SYS_001')
      return
    }

    setOpen(false)
    onArchived()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
    >
      {!isControlled && (
        <DialogTrigger render={<Button variant="outline" size="sm" />}>Archive</DialogTrigger>
      )}
      <DialogContent initialFocus={confirmRef}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Archive this goal?</DialogTitle>
            <DialogDescription>
              It will no longer be available for new contributions or withdrawals, but its history
              is kept. You can reactivate it any time.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button ref={confirmRef} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Archiving…' : 'Archive'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
