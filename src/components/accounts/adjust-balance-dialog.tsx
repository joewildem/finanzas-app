import { useState } from 'react'

import { CurrencyInput } from '@/components/accounts/currency-input'
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
import { Label } from '@/components/ui/label'
import { findAccountErrorCodeInMessage, type AccountErrorCode } from '@/lib/account-errors'
import { formatCurrency } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'

// CU-006 — el usuario solo captura el nuevo saldo; el sistema calcula la diferencia y genera la
// transacción "Ajuste manual" automáticamente (RN-015), vía el RPC atómico adjust_account_balance.
export function AdjustBalanceDialog({
  accountId,
  currentBalance,
  onAdjusted,
}: {
  accountId: string
  currentBalance: number
  onAdjusted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [nuevoSaldo, setNuevoSaldo] = useState(currentBalance)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<AccountErrorCode | null>(null)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('adjust_account_balance', {
      p_account_id: accountId,
      p_nuevo_saldo: nuevoSaldo,
    })

    setIsSubmitting(false)
    if (rpcError) {
      setError(findAccountErrorCodeInMessage(rpcError.message) ?? 'SYS_001')
      return
    }

    setOpen(false)
    onAdjusted()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setNuevoSaldo(currentBalance)
          setError(null)
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Adjust balance</DialogTrigger>
      <DialogContent>
        {/* `contents` so the form doesn't become a single grid item and break DialogContent's
            header/body/footer grid layout — wraps everything so Enter submits (standing modal
            convention: Esc/outside-click-to-close is free from base-ui, Enter-to-submit isn't). */}
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>
              Current balance: {formatCurrency(currentBalance)}. This creates an "Ajuste manual"
              entry in this account's history for the difference.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nuevo_saldo">New balance</Label>
            <CurrencyInput id="nuevo_saldo" value={nuevoSaldo} onChange={(value) => setNuevoSaldo(value ?? 0)} />
            {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save new balance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
