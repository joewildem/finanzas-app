import { useEffect, useState } from 'react'

import { AccountErrorAlert } from '@/components/account-error-alert'
import { AccountForm, type AccountFormValues } from '@/components/accounts/account-form'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthSession } from '@/lib/auth-context'
import { findAccountErrorCodeInMessage, type AccountErrorCode } from '@/lib/account-errors'
import { uploadAccountImage } from '@/lib/account-images'
import type { Account } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'

// CU-001 (crear) / CU-004 (editar) — mismo formulario compartido, en modal centrado en vez de
// pantalla aparte. Orquesta el guardado (insert/update + subida de imagen no bloqueante, BIZ_001)
// que antes vivía en la página; list/detail solo montan este diálogo y reaccionan a onSuccess.
export function AccountFormDialog({
  mode,
  account,
  open,
  onOpenChange,
  onSuccess,
}: {
  mode: 'create' | 'edit'
  account?: Account
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (account: Account) => void
}) {
  const session = useAuthSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<AccountErrorCode | null>(null)
  const [savedWithImageWarning, setSavedWithImageWarning] = useState<Account | null>(null)

  useEffect(() => {
    if (open) {
      setSubmitError(null)
      setSavedWithImageWarning(null)
    }
  }, [open])

  async function handleSubmit(values: AccountFormValues, imageFile: File | null) {
    setIsSubmitting(true)
    setSubmitError(null)

    const payload = {
      nombre: values.nombre,
      color: values.color,
      excluir_de_stats: values.excluir_de_stats,
      linea_credito: values.tipo === 'credito' ? values.linea_credito : null,
      dia_corte: values.tipo === 'credito' ? values.dia_corte : null,
      dia_pago: values.tipo === 'credito' ? values.dia_pago : null,
      gasto_minimo_mensual: values.tipo === 'credito' ? (values.gasto_minimo_mensual ?? 0) : null,
    }

    const { data: saved, error } =
      mode === 'create'
        ? await supabase
            .from('accounts')
            .insert({ user_id: session.user.id, tipo: values.tipo, saldo_inicial: values.saldo_inicial, ...payload })
            .select()
            .single()
        : await supabase.from('accounts').update(payload).eq('id', account!.id).select().single()

    if (error || !saved) {
      setSubmitError(findAccountErrorCodeInMessage(error?.message) ?? 'SYS_001')
      setIsSubmitting(false)
      return
    }

    let finalAccount = saved as Account

    if (imageFile) {
      const { url, error: uploadError } = await uploadAccountImage(session.user.id, finalAccount.id, imageFile)
      if (url) {
        const { data: updated } = await supabase
          .from('accounts')
          .update({ imagen_url: url })
          .eq('id', finalAccount.id)
          .select()
          .single()
        if (updated) finalAccount = updated as Account
      }
      setIsSubmitting(false)
      if (uploadError) {
        setSavedWithImageWarning(finalAccount)
        return
      }
    } else {
      setIsSubmitting(false)
    }

    onSuccess(finalAccount)
    onOpenChange(false)
  }

  function handleDismissWarning() {
    if (savedWithImageWarning) onSuccess(savedWithImageWarning)
    setSavedWithImageWarning(null)
    onOpenChange(false)
  }

  const formId = `account-form-${mode}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add account' : `Edit ${account?.nombre ?? ''}`}
          </DialogTitle>
        </DialogHeader>

        {savedWithImageWarning ? (
          <div className="flex flex-col gap-4">
            <AccountErrorAlert code="BIZ_001" />
            <DialogFooter>
              <Button onClick={handleDismissWarning}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <AccountForm
              formId={formId}
              mode={mode}
              defaultValues={
                account
                  ? {
                      nombre: account.nombre,
                      tipo: account.tipo,
                      saldo_inicial: account.saldo_inicial,
                      color: account.color,
                      excluir_de_stats: account.excluir_de_stats,
                      linea_credito: account.linea_credito ?? undefined,
                      dia_corte: account.dia_corte ?? undefined,
                      dia_pago: account.dia_pago ?? undefined,
                      gasto_minimo_mensual: account.gasto_minimo_mensual ?? undefined,
                    }
                  : undefined
              }
              existingImageUrl={account?.imagen_url}
              onSubmit={handleSubmit}
              submitError={submitError}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" form={formId} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create account' : 'Save changes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
