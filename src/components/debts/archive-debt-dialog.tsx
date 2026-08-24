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
import { findDebtErrorCodeInMessage, type DebtErrorCode } from '@/lib/debt-errors'
import { supabase } from '@/lib/supabase'

// CU-059 — archivar pide confirmación explícita; reactivar es el mismo cambio de status en
// reversa, sin confirmación (botón directo en el caller, mismo criterio que ArchiveGoalDialog).
// `open`/`onOpenChange` opcionales: sin ellos, autónomo con su propio botón "Archive"; con ellos,
// el caller controla la apertura (ej. desde el menú de acciones de la card).
export function ArchiveDebtDialog({
  debtId,
  onArchived,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  debtId: string
  onArchived: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isControlled = controlledOpen !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const setOpen = isControlled ? setControlledOpen! : setUncontrolledOpen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<DebtErrorCode | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)

    const { error: opError } = await supabase
      .from('debts')
      .update({ status: 'archived' })
      .eq('id', debtId)
      .eq('status', 'active')

    setIsSubmitting(false)
    if (opError) {
      setError(findDebtErrorCodeInMessage(opError.message) ?? 'SYS_001')
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
            <DialogTitle>Archive this debt?</DialogTitle>
            <DialogDescription>
              It will no longer be available for new payments, but its history is kept. You can
              reactivate it any time.
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
