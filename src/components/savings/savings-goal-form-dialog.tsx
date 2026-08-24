import { useEffect, useState } from 'react'

import { SavingsGoalForm, type SavingsGoalFormValues } from '@/components/savings/savings-goal-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthSession } from '@/lib/auth-context'
import { findSavingsErrorCodeInMessage, type SavingsErrorCode } from '@/lib/savings-errors'
import type { SavingsGoal } from '@/lib/savings-goals'
import { supabase } from '@/lib/supabase'

// CU-042 (crear) / CU-045 (editar) — mismo patrón de modal + dialog-owns-submit-state que
// CategoryGroupFormDialog: insert/update directo vía PostgREST, sin RPC.
export function SavingsGoalFormDialog({
  mode,
  goal,
  open,
  onOpenChange,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  goal?: SavingsGoal
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (goal: SavingsGoal) => void
}) {
  const session = useAuthSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<SavingsErrorCode | null>(null)

  useEffect(() => {
    if (open) setSubmitError(null)
  }, [open])

  async function handleSubmit(values: SavingsGoalFormValues) {
    setIsSubmitting(true)
    setSubmitError(null)

    const { data: saved, error } =
      mode === 'create'
        ? await supabase
            .from('savings_goals')
            .insert({ user_id: session.user.id, ...values })
            .select()
            .single()
        : await supabase.from('savings_goals').update(values).eq('id', goal!.id).select().single()

    setIsSubmitting(false)
    if (error || !saved) {
      setSubmitError(findSavingsErrorCodeInMessage(error?.message) ?? 'SYS_001')
      return
    }

    onSuccess(saved as SavingsGoal)
    onOpenChange(false)
  }

  const formId = `savings-goal-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add goal' : `Edit ${goal?.nombre ?? ''}`}</DialogTitle>
        </DialogHeader>
        <SavingsGoalForm
          formId={formId}
          defaultValues={
            goal
              ? {
                  nombre: goal.nombre,
                  emoji: goal.emoji,
                  monto_objetivo: goal.monto_objetivo,
                  monto_inicial: goal.monto_inicial,
                  fecha_limite: goal.fecha_limite,
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
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create goal' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
