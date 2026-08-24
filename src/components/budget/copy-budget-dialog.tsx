import { useRef, useState } from 'react'

import { BudgetErrorAlert } from '@/components/budget-error-alert'
import { MonthNav } from '@/components/budget/month-nav'
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
import { monthKeyLabel, shiftMonthKey } from '@/lib/budgets'
import { findBudgetErrorCodeInMessage, type BudgetErrorCode } from '@/lib/budget-errors'
import { supabase } from '@/lib/supabase'

// CU-020 — un solo diálogo resuelve el flujo de dos pasos de RN-062: el primer intento va sin
// confirmar sobrescritura; si el backend responde BIZ_017 (el mes destino ya tiene presupuesto), el
// diálogo cambia a un estado de advertencia y el mismo botón reintenta con
// `p_confirmar_sobrescritura=true` — sin anidar un segundo diálogo de confirmación.
export function CopyBudgetDialog({ mesDestino, onCopied }: { mesDestino: string; onCopied: () => void }) {
  const [open, setOpen] = useState(false)
  const [mesOrigen, setMesOrigen] = useState(() => shiftMonthKey(mesDestino, -1))
  const [needsConfirm, setNeedsConfirm] = useState(false)
  const [errorCode, setErrorCode] = useState<BudgetErrorCode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)

  function resetState() {
    setMesOrigen(shiftMonthKey(mesDestino, -1))
    setNeedsConfirm(false)
    setErrorCode(null)
    setIsSubmitting(false)
  }

  async function handleConfirm() {
    setIsSubmitting(true)
    const { error } = await supabase.rpc('copy_budget_month', {
      p_mes_origen: mesOrigen,
      p_mes_destino: mesDestino,
      p_confirmar_sobrescritura: needsConfirm,
    })
    setIsSubmitting(false)

    if (!error) {
      setOpen(false)
      resetState()
      onCopied()
      return
    }

    const code = findBudgetErrorCodeInMessage(error.message)
    if (code === 'BIZ_017') {
      setNeedsConfirm(true)
      setErrorCode(code)
      return
    }
    setErrorCode(code ?? 'SYS_001')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Recompute on every open too, not just on close — `mesOrigen`'s initial state is set once
        // at mount from the `mesDestino` prop at that time, so it goes stale once the page's month
        // changes between dialog opens (it would otherwise resubmit against a now-wrong origin).
        resetState()
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>Copy from another month</DialogTrigger>
      <DialogContent initialFocus={confirmRef}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleConfirm()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>Copy budget to {monthKeyLabel(mesDestino)}</DialogTitle>
            <DialogDescription>
              Choose the month to copy amounts from. This applies to every category and Savings that
              had a budget in that month.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-2">
            <MonthNav mes={mesOrigen} onChange={setMesOrigen} />
          </div>

          <BudgetErrorAlert code={errorCode} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button ref={confirmRef} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Copying…' : needsConfirm ? 'Overwrite and copy' : 'Copy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
