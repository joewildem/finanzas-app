import { useEffect, useState } from 'react'

import { InvestmentForm, type InvestmentFormValues } from '@/components/investments/investment-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthSession } from '@/lib/auth-context'
import { findInvestmentErrorCodeInMessage, type InvestmentErrorCode } from '@/lib/investment-errors'
import type { Investment } from '@/lib/investments'
import { supabase } from '@/lib/supabase'

// CU-049 (crear) / CU-051 (editar ficha) — mismo patrón de modal + dialog-owns-submit-state que
// SavingsGoalFormDialog: insert/update directo vía PostgREST, sin RPC. RN-145 — si se capturó
// balance_actual > 0 al crear, se registra además la primera fila de investment_balance_history con
// la fecha de hoy (segundo insert, no atómico con el primero — ver nota en handleSubmit).
export function InvestmentFormDialog({
  mode,
  investment,
  open,
  onOpenChange,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  investment?: Investment
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (investment: Investment) => void
}) {
  const session = useAuthSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<InvestmentErrorCode | null>(null)

  useEffect(() => {
    if (open) setSubmitError(null)
  }, [open])

  async function handleSubmit(values: InvestmentFormValues) {
    setIsSubmitting(true)
    setSubmitError(null)

    if (mode === 'create') {
      const { data: saved, error } = await supabase
        .from('investments')
        .insert({
          user_id: session.user.id,
          ticker: values.ticker,
          nombre: values.nombre,
          grupo_activo: values.grupo_activo,
          tipo_activo: values.tipo_activo,
          balance_actual: values.balance_actual ?? 0,
        })
        .select()
        .single()

      if (error || !saved) {
        setIsSubmitting(false)
        setSubmitError(findInvestmentErrorCodeInMessage(error) ?? 'SYS_001')
        return
      }

      // RN-145 — no atómico con el alta: si este segundo insert fallara, el instrumento queda
      // creado sin la fila inicial de histórico, recuperable en el próximo guardado del portafolio
      // (CU-052, que siempre escribe una fila por instrumento incluido en el lote).
      if ((values.balance_actual ?? 0) > 0) {
        await supabase.from('investment_balance_history').insert({
          user_id: session.user.id,
          investment_id: (saved as Investment).id,
          fecha: new Date().toISOString().slice(0, 10),
          balance: values.balance_actual,
        })
      }

      setIsSubmitting(false)
      onSuccess(saved as Investment)
      onOpenChange(false)
      return
    }

    const { data: saved, error } = await supabase
      .from('investments')
      .update({
        ticker: values.ticker,
        nombre: values.nombre,
        grupo_activo: values.grupo_activo,
        tipo_activo: values.tipo_activo,
      })
      .eq('id', investment!.id)
      .select()
      .single()

    setIsSubmitting(false)
    if (error || !saved) {
      setSubmitError(findInvestmentErrorCodeInMessage(error) ?? 'SYS_001')
      return
    }

    onSuccess(saved as Investment)
    onOpenChange(false)
  }

  const formId = `investment-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add instrument' : `Edit ${investment?.ticker ?? ''}`}</DialogTitle>
        </DialogHeader>
        <InvestmentForm
          formId={formId}
          mode={mode}
          defaultValues={
            investment
              ? {
                  ticker: investment.ticker,
                  nombre: investment.nombre,
                  grupo_activo: investment.grupo_activo,
                  tipo_activo: investment.tipo_activo,
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
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Add instrument' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
