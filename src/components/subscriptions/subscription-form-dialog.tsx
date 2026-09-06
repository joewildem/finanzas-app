import { useEffect, useState } from 'react'

import {
  SubscriptionForm,
  type SubscriptionFormValues,
} from '@/components/subscriptions/subscription-form'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthSession } from '@/lib/auth-context'
import { findSubscriptionErrorCode, type SubscriptionErrorCode } from '@/lib/subscription-errors'
import type { Subscription } from '@/lib/subscriptions'
import { supabase } from '@/lib/supabase'

// CU-078 (crear) / CU-080 (editar) — insert/update directo vía PostgREST, sin RPC: crear una
// suscripción no mueve el saldo de nada, así que no hay nada que coordinar en una transacción.
export function SubscriptionFormDialog({
  mode,
  subscription,
  open,
  onOpenChange,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  subscription?: Subscription
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const session = useAuthSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<SubscriptionErrorCode | null>(null)

  useEffect(() => {
    if (open) setSubmitError(null)
  }, [open])

  async function handleSubmit({ tiene_fin, ...values }: SubscriptionFormValues) {
    setIsSubmitting(true)
    setSubmitError(null)

    // `tiene_fin` es del formulario, no de la tabla: si está apagado la fecha ya viene en null.
    const payload = { ...values, fecha_fin: tiene_fin ? values.fecha_fin : null }

    const { error } =
      mode === 'create'
        ? await supabase.from('subscriptions').insert({ user_id: session.user.id, ...payload })
        : await supabase.from('subscriptions').update(payload).eq('id', subscription!.id)

    setIsSubmitting(false)
    if (error) {
      setSubmitError(findSubscriptionErrorCode(error) ?? 'SYS_001')
      return
    }

    onSuccess()
    onOpenChange(false)
  }

  const formId = `subscription-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add subscription' : `Edit ${subscription?.nombre ?? ''}`}
          </DialogTitle>
        </DialogHeader>
        <SubscriptionForm
          formId={formId}
          defaultValues={
            subscription
              ? {
                  nombre: subscription.nombre,
                  categoria: subscription.categoria,
                  sitio_web: subscription.sitio_web,
                  monto: subscription.monto,
                  ciclo: subscription.ciclo,
                  fecha_inicio: subscription.fecha_inicio,
                  tiene_fin: subscription.fecha_fin !== null,
                  fecha_fin: subscription.fecha_fin,
                  es_prueba: subscription.es_prueba,
                  metodo_pago: subscription.metodo_pago,
                  nota: subscription.nota,
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
            {isSubmitting ? 'Saving…' : mode === 'create' ? 'Add subscription' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
