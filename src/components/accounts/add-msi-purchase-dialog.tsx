import { useState } from 'react'
import { format } from 'date-fns'
import { HugeiconsIcon } from '@hugeicons/react'
import { PencilEdit01Icon } from '@hugeicons/core-free-icons'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { currentMonthKey, monthKeyLabel, shiftMonthKey } from '@/lib/budgets'
import { MSI_MONTH_OPTIONS, type MsiPlan } from '@/lib/msi'
import { supabase } from '@/lib/supabase'
import { findTransactionErrorCodeInMessage, TRANSACTION_ERROR_MESSAGES } from '@/lib/transaction-errors'

// Meses ofrecidos como inicio del plan: el actual y los tres siguientes. Comprar después de la fecha
// de corte empuja la primera parcialidad al mes siguiente, así que el mes de la compra no siempre es
// el correcto — por eso se elige en vez de derivarse.
const START_MONTH_CHOICES = 4

// Alta de una compra a meses sin intereses (RPC create_msi_purchase). Vive en el detalle de la
// tarjeta y no en el modal general de "Add record" porque no es un gasto: no lleva categoría, y esa
// ausencia es justamente lo que la mantiene fuera de los reportes de gasto por categoría — ver la
// migración 20260904100000.
export function AddMsiPurchaseDialog({
  accountId,
  plan,
  onCreated,
}: {
  accountId: string
  /** Presente = modo edición sobre ese plan; ausente = alta. */
  plan?: MsiPlan
  onCreated: () => void
}) {
  const isEdit = plan !== undefined
  const [open, setOpen] = useState(false)
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState<number | undefined>(undefined)
  const [meses, setMeses] = useState<number>(12)
  const [mesInicio, setMesInicio] = useState(currentMonthKey())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthOptions = Array.from({ length: START_MONTH_CHOICES }, (_, i) =>
    shiftMonthKey(currentMonthKey(), i),
  )
  const allMonthOptions = monthOptions.includes(mesInicio) ? monthOptions : [mesInicio, ...monthOptions]
  const mensualidad = monto && meses ? monto / meses : 0

  // Al abrir: en alta arranca en blanco, en edición se puebla con el plan. El mes de inicio de un
  // plan viejo puede caer fuera de las opciones ofrecidas (que arrancan en el mes actual), así que se
  // agrega a la lista para no perderlo al guardar.
  function resetForm() {
    setConcepto(plan?.concepto ?? '')
    setMonto(plan ? Math.abs(plan.monto) : undefined)
    setMeses(plan?.meses ?? 12)
    setMesInicio(plan?.mesInicio ?? currentMonthKey())
    setError(null)
  }

  async function handleSubmit() {
    setError(null)

    if (concepto.trim().length < 2) {
      setError(TRANSACTION_ERROR_MESSAGES.VALIDATION_001)
      return
    }
    if (!monto || monto <= 0) {
      setError(TRANSACTION_ERROR_MESSAGES.VALIDATION_012)
      return
    }

    setIsSubmitting(true)
    const { error: rpcError } = isEdit
      ? await supabase.rpc('update_msi_purchase', {
          p_transaction_id: plan.id,
          p_concepto: concepto.trim(),
          p_monto: monto,
          p_meses: meses,
          p_mes_inicio: mesInicio,
          p_nota: plan.nota,
        })
      : await supabase.rpc('create_msi_purchase', {
          p_account_id: accountId,
          p_concepto: concepto.trim(),
          p_monto: monto,
          p_meses: meses,
          p_mes_inicio: mesInicio,
          p_fecha: format(new Date(), 'yyyy-MM-dd'),
          p_nota: null,
        })
    setIsSubmitting(false)

    if (rpcError) {
      const code = findTransactionErrorCodeInMessage(rpcError.message)
      setError(code ? TRANSACTION_ERROR_MESSAGES[code] : TRANSACTION_ERROR_MESSAGES.SYS_001)
      return
    }

    setOpen(false)
    resetForm()
    onCreated()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) resetForm()
      }}
    >
      <DialogTrigger
        render={
          isEdit ? (
            <Button variant="ghost" size="icon-sm" aria-label="Edit installment plan" />
          ) : (
            <Button variant="outline" />
          )
        }
      >
        {isEdit ? <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" /> : 'Add installment purchase'}
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
          className="contents"
        >
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit installment plan' : 'Add installment purchase'}</DialogTitle>
            <DialogDescription>
              The full amount is charged to this card right away, just like the bank does. The
              monthly installment is what shows up in your budget.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="msi_concepto">Description</Label>
              <Input
                id="msi_concepto"
                value={concepto}
                onChange={(event) => setConcepto(event.target.value)}
                maxLength={50}
                placeholder="TV, laptop, flight…"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="msi_monto">Total amount</Label>
              <CurrencyInput id="msi_monto" value={monto} onChange={setMonto} allowEmpty />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="msi_meses">Installments</Label>
                <Select value={String(meses)} onValueChange={(value) => setMeses(Number(value))}>
                  <SelectTrigger id="msi_meses" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MSI_MONTH_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} months
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="msi_inicio">First payment</Label>
                <Select value={mesInicio} onValueChange={(value) => value && setMesInicio(value)}>
                  <SelectTrigger id="msi_inicio" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allMonthOptions.map((mes) => (
                      <SelectItem key={mes} value={mes}>
                        {monthKeyLabel(mes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mensualidad > 0 && (
              <p className="text-sm text-muted-foreground">
                About{' '}
                <span className="font-mono text-foreground">
                  {mensualidad.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </span>{' '}
                per month, starting {monthKeyLabel(mesInicio)}.
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add purchase'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
