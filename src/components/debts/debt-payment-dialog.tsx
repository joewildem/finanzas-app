import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Note01Icon } from '@hugeicons/core-free-icons'
import { format } from 'date-fns'

import { CurrencyInput } from '@/components/accounts/currency-input'
import { AccountPickerRow } from '@/components/transactions/account-picker-row'
import { DatePickerRow } from '@/components/transactions/date-picker-row'
import { TransactionErrorAlert } from '@/components/transaction-error-alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useAccounts } from '@/hooks/use-accounts'
import type { AccountType } from '@/lib/accounts'
import { formatCurrency } from '@/lib/accounts'
import type { Debt } from '@/lib/debts'
import { supabase } from '@/lib/supabase'
import { findTransactionErrorCodeInMessage, type TransactionErrorCode } from '@/lib/transaction-errors'

const PAYMENT_ELIGIBLE_TYPES: AccountType[] = ['debito', 'efectivo']

// CU-060 — no cabe en el modal general de transacciones (AddTransactionDialog): ese modal tiene un
// único monto "hero", pero un pago de deuda se divide en capital + interés (RN-215). Mismo criterio
// ya aprobado para "Withdraw from goal": modal dedicado, abierto desde el detalle de la deuda o el
// menú de su card, deliberadamente más chico que AddTransactionDialog. El usuario captura el monto
// TOTAL pagado (el número que conoce, el que salió de su cuenta) y el interés (el dato que su banco
// reporta); el capital se deriva — evita que tenga que restar a mano.
export function DebtPaymentDialog({
  debt,
  open,
  onOpenChange,
  onSuccess,
}: {
  debt: Debt
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { accounts } = useAccounts(false)
  const eligibleAccounts = (accounts ?? []).filter((a) => PAYMENT_ELIGIBLE_TYPES.includes(a.tipo))

  const [total, setTotal] = useState(0)
  const [interest, setInterest] = useState(0)
  const [accountId, setAccountId] = useState('')
  const [fecha, setFecha] = useState(() => new Date())
  const [nota, setNota] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<TransactionErrorCode | null>(null)

  useEffect(() => {
    if (open) {
      setTotal(0)
      setInterest(0)
      setAccountId('')
      setFecha(new Date())
      setNota('')
      setSubmitError(null)
    }
  }, [open])

  const principal = Math.max(total - interest, 0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)

    if (!total || total <= 0) {
      setSubmitError('VALIDATION_012')
      return
    }
    if (interest > total) {
      setSubmitError('VALIDATION_035')
      return
    }
    if (!accountId) {
      setSubmitError('VALIDATION_001')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.rpc('create_debt_payment', {
      p_deuda_id: debt.id,
      p_account_id: accountId,
      p_monto_capital: principal,
      p_monto_interes: interest,
      p_fecha: format(fecha, 'yyyy-MM-dd'),
      p_nota: nota || null,
    })
    setIsSubmitting(false)
    if (error) {
      setSubmitError(findTransactionErrorCodeInMessage(error.message) ?? 'SYS_001')
      return
    }
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Register payment — {debt.nombre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TransactionErrorAlert code={submitError} />

          <div className="relative flex items-center py-2">
            <CurrencyInput id="payment_total" variant="hero" autoFocus value={total} onChange={(value) => setTotal(value ?? 0)} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="payment_interest">Interest</Label>
            <CurrencyInput id="payment_interest" value={interest} onChange={(value) => setInterest(value ?? 0)} />
            <p className="text-xs text-muted-foreground">Principal: {formatCurrency(principal)}</p>
          </div>

          <AccountPickerRow label="From" accounts={eligibleAccounts} accountId={accountId} onSelect={setAccountId} />

          <DatePickerRow value={fecha} onChange={setFecha} />

          <div className="flex w-full items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground">
              <HugeiconsIcon icon={Note01Icon} className="size-4.5" />
            </span>
            <input
              value={nota}
              onChange={(event) => setNota(event.target.value)}
              maxLength={140}
              placeholder="Add a note"
              aria-label="Note"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !total}>
              {isSubmitting ? 'Saving…' : 'Register payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
