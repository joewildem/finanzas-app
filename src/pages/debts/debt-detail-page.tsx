import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { SearchRemoveIcon } from '@hugeicons/core-free-icons'
import { useParams } from 'react-router-dom'

import { ArchiveDebtDialog } from '@/components/debts/archive-debt-dialog'
import { DebtFormDialog } from '@/components/debts/debt-form-dialog'
import { DebtPaymentDialog } from '@/components/debts/debt-payment-dialog'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GoalProgressRing } from '@/components/savings/goal-progress-ring'
import { useDebt } from '@/hooks/use-debt'
import { MovementAmount } from '@/components/movement-amount'
import { formatCurrency } from '@/lib/accounts'
import { useAddTransaction } from '@/lib/add-transaction-context'
import {
  computeMonthsRemaining,
  computePercentPagado,
  computeSaldoActual,
  DEBT_TYPE_ICONS,
  DEBT_TYPE_LABELS,
} from '@/lib/debts'
import { supabase } from '@/lib/supabase'
import { formatPercent } from '@/lib/utils'

// CU-057 — mismo layout que SavingsGoalDetailPage: header (ícono por tipo + nombre + badges +
// Edit/Archive), card de stats con GoalProgressRing (reutilizado, % pagado), card de historial de
// pagos (fecha, cuenta, capital, interés, total).
export function DebtDetailPage() {
  const { debtId } = useParams<{ debtId: string }>()
  const { debt, payments, refetch } = useDebt(debtId)
  const [editOpen, setEditOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  // Un pago registrado desde el modal general de transacciones (al editar un pago_deuda existente)
  // no conoce el `refetch` de esta página — suscribirse evita que el detalle quede desactualizado.
  const { subscribe } = useAddTransaction()
  useEffect(() => subscribe(refetch), [subscribe, refetch])

  if (debt === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (debt === null) {
    return <EmptyState icon={SearchRemoveIcon} title="Debt not found" />
  }

  async function handleReactivate() {
    if (!debtId) return
    await supabase.from('debts').update({ status: 'active' }).eq('id', debtId).eq('status', 'archived')
    refetch()
  }

  const capitalPagos = payments.filter((p) => p.monto_capital !== null).map((p) => p.monto_capital as number)
  const saldoActual = computeSaldoActual(debt, capitalPagos)
  const percent = computePercentPagado(saldoActual, debt.monto_original)
  const monthsRemaining = computeMonthsRemaining(debt.fecha_liquidacion_estimada)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <HugeiconsIcon icon={DEBT_TYPE_ICONS[debt.tipo]} className="size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-medium text-foreground">{debt.nombre}</h1>
              {debt.status === 'archived' && <Badge variant="secondary">Paid off</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {DEBT_TYPE_LABELS[debt.tipo]} · {formatCurrency(debt.monto_original)} original
              {debt.fecha_liquidacion_estimada &&
                ` · est. payoff ${new Date(debt.fecha_liquidacion_estimada).toLocaleDateString()}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {debt.status === 'active' && (
            <Button onClick={() => setPaymentOpen(true)}>Register payment</Button>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          {debt.status === 'active' ? (
            <ArchiveDebtDialog debtId={debt.id} onArchived={refetch} />
          ) : (
            <button onClick={handleReactivate} className={buttonVariants({ variant: 'outline' })}>
              Reactivate
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Progress</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <GoalProgressRing percent={percent} size={88} strokeWidth={7}>
            <span className="text-sm font-medium text-card-foreground">{formatPercent(percent * 100)}</span>
          </GoalProgressRing>
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="font-mono text-lg text-card-foreground">{formatCurrency(saldoActual)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Original</p>
              <p className="font-mono text-lg text-card-foreground">{formatCurrency(debt.monto_original)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest rate</p>
              <p className="font-mono text-lg text-card-foreground">{debt.tasa_interes}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Payoff estimate</p>
              <p className="text-lg text-card-foreground">
                {monthsRemaining !== null ? `${monthsRemaining} mo` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-card-foreground">
                      {payment.account?.nombre ?? 'Unknown account'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.fecha).toLocaleDateString()} · Principal{' '}
                      {formatCurrency(payment.monto_capital ?? 0)} · Interest{' '}
                      {formatCurrency(payment.monto_interes ?? 0)}
                    </p>
                  </div>
                  <MovementAmount monto={payment.monto} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <DebtFormDialog mode="edit" debt={debt} open={editOpen} onOpenChange={setEditOpen} onSuccess={() => refetch()} />
      <DebtPaymentDialog debt={debt} open={paymentOpen} onOpenChange={setPaymentOpen} onSuccess={refetch} />
    </div>
  )
}
