import { useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon } from '@hugeicons/core-free-icons'

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
import { supabase } from '@/lib/supabase'
import { findTransactionErrorCodeInMessage, type TransactionErrorCode } from '@/lib/transaction-errors'

// CU-018 — sin patrón de archivado (a diferencia de Cuentas/Categorías): la eliminación es
// permanente y revierte el efecto sobre `saldo_actual`. Si la transacción está enlazada
// (transferencia o pago a tarjeta), el RPC `delete_transaction` borra también el documento
// relacionado (cascada por FK) y revierte ambas cuentas en la misma operación (RN-054/RN-055).
export function DeleteTransactionDialog({
  transactionId,
  isLinked,
  onDeleted,
}: {
  transactionId: string
  isLinked: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<TransactionErrorCode | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)
    const { error: opError } = await supabase.rpc('delete_transaction', { p_transaction_id: transactionId })
    setIsSubmitting(false)
    if (opError) {
      setError(findTransactionErrorCodeInMessage(opError.message) ?? 'SYS_001')
      return
    }
    setOpen(false)
    onDeleted()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setError(null)
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Delete transaction" />}>
        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
      </DialogTrigger>
      <DialogContent initialFocus={confirmRef}>
        {/* `contents` — mismo patrón que ArchiveAccountDialog para que Enter dispare el submit. */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Delete this transaction?</DialogTitle>
            <DialogDescription>
              This can't be undone. The balance of {isLinked ? 'both accounts involved' : 'its account'} will be
              adjusted to reverse its effect
              {isLinked ? ', and the linked side of this movement will be deleted too.' : '.'}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button ref={confirmRef} type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
