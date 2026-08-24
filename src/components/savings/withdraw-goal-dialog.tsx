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
import { useAccounts } from '@/hooks/use-accounts'
import type { AccountType } from '@/lib/accounts'
import type { SavingsGoal } from '@/lib/savings-goals'
import { supabase } from '@/lib/supabase'
import { findTransactionErrorCodeInMessage, type TransactionErrorCode } from '@/lib/transaction-errors'

const WITHDRAWAL_ELIGIBLE_TYPES: AccountType[] = ['debito', 'efectivo']

// CU-048 — a diferencia del chip "Savings" del modal general (que sí deja elegir tipo y meta), un
// retiro siempre se abre desde el contexto de una meta específica (detalle o menú de su card): la
// meta queda fija/de solo lectura y no hay selector de tipo ni de categoría, solo monto, cuenta,
// fecha y nota — un modal deliberadamente más chico que AddTransactionDialog, no una reutilización.
export function WithdrawGoalDialog({
  goal,
  open,
  onOpenChange,
  onSuccess,
}: {
  goal: SavingsGoal
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const { accounts } = useAccounts(false)
  const eligibleAccounts = (accounts ?? []).filter((a) => WITHDRAWAL_ELIGIBLE_TYPES.includes(a.tipo))

  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState('')
  const [fecha, setFecha] = useState(() => new Date())
  const [nota, setNota] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<TransactionErrorCode | null>(null)

  useEffect(() => {
    if (open) {
      setAmount(0)
      setAccountId('')
      setFecha(new Date())
      setNota('')
      setSubmitError(null)
    }
  }, [open])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitError(null)

    if (!amount || amount <= 0) {
      setSubmitError('VALIDATION_012')
      return
    }
    if (!accountId) {
      setSubmitError('VALIDATION_001')
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.rpc('create_goal_withdrawal', {
      p_meta_id: goal.id,
      p_account_id: accountId,
      p_monto: amount,
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
          <DialogTitle>Withdraw from {goal.nombre}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TransactionErrorAlert code={submitError} />

          <div className="relative flex items-center py-2">
            <CurrencyInput
              id="withdraw_monto"
              variant="hero"
              autoFocus
              value={amount}
              onChange={(value) => setAmount(value ?? 0)}
            />
          </div>

          <div className="flex w-full items-center justify-between rounded-lg bg-muted px-3 py-2.5 opacity-70">
            <span className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full bg-background text-muted-foreground">
                <span className="text-base">{goal.emoji}</span>
              </span>
              <span className="text-sm font-medium text-foreground">Goal</span>
            </span>
            <span className="text-sm text-foreground">{goal.nombre}</span>
          </div>

          <AccountPickerRow label="To" accounts={eligibleAccounts} accountId={accountId} onSelect={setAccountId} />

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
            <Button type="submit" disabled={isSubmitting || !amount}>
              {isSubmitting ? 'Saving…' : 'Withdraw'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
