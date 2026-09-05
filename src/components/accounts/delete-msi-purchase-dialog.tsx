import { useState } from 'react'
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
import { formatCurrency } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'

// Borrar un plan revierte su cargo en la tarjeta (delete_transaction ya lo hace para cualquier
// movimiento) y arrastra los pagos capturados de sus parcialidades, que sin el plan no significan
// nada — la llave foránea de `msi_payments` está en cascada.
export function DeleteMsiPurchaseDialog({
  transactionId,
  concepto,
  monto,
  onDeleted,
}: {
  transactionId: string
  concepto: string
  monto: number
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('delete_transaction', {
      p_transaction_id: transactionId,
    })
    setIsDeleting(false)

    if (rpcError) {
      setError('Something went wrong. Try again.')
      return
    }

    setOpen(false)
    onDeleted()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="Delete installment plan" />}
      >
        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this plan?</DialogTitle>
          <DialogDescription>
            "{concepto}" ({formatCurrency(monto)}) will be removed and the card balance will go back
            down by that amount. Any payments you recorded against its installments are deleted too.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
