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
import { formatCurrency } from '@/lib/accounts'
import { findSavingsErrorCodeInMessage, SAVINGS_ERROR_MESSAGES, type SavingsErrorCode } from '@/lib/savings-errors'
import { supabase } from '@/lib/supabase'

// El saldo actual sale de sumar montos en punto flotante: sin redondear, un saldo capturado idéntico
// podía diferir por 0.0000001 y habilitar un ajuste de $0.00. Postgres guarda `numeric(14,2)`.
function roundCents(value: number): number {
  return Math.round(value * 100) / 100
}

// CU-084 — equivalente para metas del ajuste de saldo de cuenta (CU-006): el usuario captura solo el
// saldo nuevo y el sistema registra la diferencia, vía el RPC adjust_goal_balance. Existe para los
// rendimientos de una meta guardada en un instrumento que paga intereses: el saldo sube sin que el
// dinero salga de ninguna cuenta, así que no puede registrarse como aportación.
//
// Sin cuenta, fecha ni nota, igual que el ajuste de cuenta: el ajuste se fecha al momento de guardarlo.
export function AdjustGoalBalanceDialog({
  goalId,
  currentAmount,
  onAdjusted,
}: {
  goalId: string
  currentAmount: number
  onAdjusted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [nuevoMonto, setNuevoMonto] = useState(() => roundCents(currentAmount))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<SavingsErrorCode | null>(null)

  const diff = roundCents(nuevoMonto - currentAmount)

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('adjust_goal_balance', {
      p_meta_id: goalId,
      p_nuevo_monto: nuevoMonto,
    })

    setIsSubmitting(false)
    if (rpcError) {
      setError(findSavingsErrorCodeInMessage(rpcError.message) ?? 'SYS_001')
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
          setNuevoMonto(roundCents(currentAmount))
          setError(null)
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Adjust balance</DialogTrigger>
      <DialogContent>
        {/* `contents` — mismo patrón que AdjustBalanceDialog de cuentas para que Enter dispare el submit
            sin romper el grid de DialogContent. */}
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
              Current balance: {formatCurrency(currentAmount)}. The difference is recorded in this goal's
              history as a balance adjustment — no account is affected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nuevo_monto_meta">New balance</Label>
            <CurrencyInput
              id="nuevo_monto_meta"
              value={nuevoMonto}
              onChange={(value) => setNuevoMonto(value ?? 0)}
            />
            {/* Anticipa qué va a quedar en el historial antes de guardar: con rendimientos es fácil
                capturar el saldo de otro día y registrar una baja sin darse cuenta. */}
            {diff !== 0 && (
              <p className="text-sm text-muted-foreground">
                {diff > 0
                  ? `Adds ${formatCurrency(diff)} to this goal.`
                  : `Takes ${formatCurrency(Math.abs(diff))} out of this goal.`}
              </p>
            )}
            {error && <p className="text-sm text-destructive">{SAVINGS_ERROR_MESSAGES[error]}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {/* Sin diferencia no hay nada que registrar (RN-334) — el RPC tampoco lo guardaría. */}
            <Button type="submit" disabled={isSubmitting || diff === 0}>
              {isSubmitting ? 'Saving…' : 'Save new balance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
