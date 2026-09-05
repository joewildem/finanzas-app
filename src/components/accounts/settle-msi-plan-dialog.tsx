import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/accounts'
import { currentMonthKey, monthKeyLabel } from '@/lib/budgets'
import { computeInstallmentSchedule, type MsiPlan } from '@/lib/msi'
import { supabase } from '@/lib/supabase'

// Liquidación anticipada: el mes elegido concentra todo lo que faltaba y el plan deja de aparecer en
// los meses siguientes. No mueve el saldo de la tarjeta — la deuda ya estaba cargada completa desde
// la compra, y el dinero que sale se registra como un pago a la tarjeta normal.
export function SettleMsiPlanDialog({ plan, onSettled }: { plan: MsiPlan; onSettled: () => void }) {
  const [open, setOpen] = useState(false)
  const [mes, setMes] = useState(currentMonthKey())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSettled = plan.liquidadoMes !== null

  // Solo se puede liquidar dentro del rango del plan (lo valida también el RPC): antes de que
  // empiece no hay nada que adelantar, después de que termina ya no queda saldo.
  const scheduleSinLiquidar = computeInstallmentSchedule({ ...plan, liquidadoMes: null })
  const mesesElegibles = scheduleSinLiquidar.map((cuota) => cuota.mes)
  const pendienteDesde = scheduleSinLiquidar
    .filter((cuota) => cuota.mes >= mes)
    .reduce((sum, cuota) => sum + cuota.monto, 0)

  async function handleSubmit(nuevoMes: string | null) {
    setIsSubmitting(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('set_msi_settlement', {
      p_transaction_id: plan.id,
      p_mes: nuevoMes,
    })
    setIsSubmitting(false)

    if (rpcError) {
      setError('Something went wrong. Try again.')
      return
    }

    setOpen(false)
    onSettled()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setMes(plan.liquidadoMes ?? currentMonthKey())
          setError(null)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={isSettled ? 'Settled early' : 'Settle plan early'}
          />
        }
      >
        <HugeiconsIcon
          icon={CheckmarkCircle02Icon}
          className={isSettled ? 'size-4 text-brand' : 'size-4'}
        />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSettled ? 'Settled early' : 'Settle this plan early'}</DialogTitle>
          <DialogDescription>
            {isSettled
              ? `"${plan.concepto}" is marked as paid off in ${monthKeyLabel(plan.liquidadoMes!)}. Its remaining installments were rolled into that month.`
              : `Pick the month you pay off the rest of "${plan.concepto}". That month absorbs everything still owed, and the plan stops showing up afterwards.`}
          </DialogDescription>
        </DialogHeader>

        {!isSettled && (
          <div className="flex flex-col gap-3">
            <Select value={mes} onValueChange={(value) => value && setMes(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mesesElegibles.map((m) => (
                  <SelectItem key={m} value={m}>
                    {monthKeyLabel(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Amount due that month:{' '}
              <span className="font-mono text-foreground">{formatCurrency(pendienteDesde)}</span>
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {isSettled ? (
            <Button type="button" variant="outline" onClick={() => handleSubmit(null)} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Undo settlement'}
            </Button>
          ) : (
            <Button type="button" onClick={() => handleSubmit(mes)} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Mark as settled'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
