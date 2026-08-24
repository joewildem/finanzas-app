import { useEffect, useState } from 'react'

import { DebtForm, type DebtFormValues } from '@/components/debts/debt-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthSession } from '@/lib/auth-context'
import { findDebtErrorCodeInMessage, type DebtErrorCode } from '@/lib/debt-errors'
import type { Debt } from '@/lib/debts'
import { supabase } from '@/lib/supabase'

// CU-055 (crear) / CU-058 (editar) — mismo patrón de modal + dialog-owns-submit-state que
// SavingsGoalFormDialog: insert/update directo vía PostgREST, sin RPC. A diferencia de
// InvestmentFormDialog, `monto_original` es editable en ambos modos (RN-197).
export function DebtFormDialog({
  mode,
  debt,
  open,
  onOpenChange,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  debt?: Debt
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (debt: Debt) => void
}) {
  const session = useAuthSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<DebtErrorCode | null>(null)

  useEffect(() => {
    if (open) setSubmitError(null)
  }, [open])

  async function handleSubmit(values: DebtFormValues) {
    setIsSubmitting(true)
    setSubmitError(null)

    const payload = {
      nombre: values.nombre,
      tipo: values.tipo,
      monto_original: values.monto_original,
      tasa_interes: values.tasa_interes,
      pago_mensual_esperado: values.pago_mensual_esperado ?? null,
      dia_pago: values.dia_pago ?? null,
      fecha_liquidacion_estimada: values.fecha_liquidacion_estimada,
    }

    const { data: saved, error } =
      mode === 'create'
        ? await supabase
            .from('debts')
            .insert({ user_id: session.user.id, ...payload })
            .select()
            .single()
        : await supabase.from('debts').update(payload).eq('id', debt!.id).select().single()

    setIsSubmitting(false)
    if (error || !saved) {
      setSubmitError(findDebtErrorCodeInMessage(error?.message) ?? 'SYS_001')
      return
    }

    onSuccess(saved as Debt)
    onOpenChange(false)
  }

  const formId = `debt-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add debt' : `Edit ${debt?.nombre ?? ''}`}</DialogTitle>
        </DialogHeader>
        <DebtForm
          formId={formId}
          defaultValues={
            debt
              ? {
                  nombre: debt.nombre,
                  tipo: debt.tipo,
                  monto_original: debt.monto_original,
                  tasa_interes: debt.tasa_interes,
                  pago_mensual_esperado: debt.pago_mensual_esperado ?? undefined,
                  dia_pago: debt.dia_pago ?? undefined,
                  fecha_liquidacion_estimada: debt.fecha_liquidacion_estimada,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          submitError={submitError}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Add debt' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
