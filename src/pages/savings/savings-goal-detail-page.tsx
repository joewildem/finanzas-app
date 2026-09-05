import { useEffect, useState } from 'react'
import { SearchRemoveIcon } from '@hugeicons/core-free-icons'
import { useParams } from 'react-router-dom'

import { ArchiveGoalDialog } from '@/components/savings/archive-goal-dialog'
import { GoalProgressRing } from '@/components/savings/goal-progress-ring'
import { SavingsGoalFormDialog } from '@/components/savings/savings-goal-form-dialog'
import { WithdrawGoalDialog } from '@/components/savings/withdraw-goal-dialog'
import { EmptyState } from '@/components/empty-state'
import { MovementAmount } from '@/components/movement-amount'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSavingsGoal } from '@/hooks/use-savings-goal'
import { formatCurrency } from '@/lib/accounts'
import { useAddTransaction } from '@/lib/add-transaction-context'
import {
  computeMonthsRemaining,
  computeMontoAportadoActual,
  computeMontoRestante,
  computePercent,
} from '@/lib/savings-goals'
import { supabase } from '@/lib/supabase'
import { TRANSACTION_TYPE_LABELS } from '@/lib/transactions'
import { formatPercent } from '@/lib/utils'

// CU-044 — mismo layout que AccountDetailPage: header (emoji + nombre + badges + Edit/Archive),
// card de stats con GoalProgressRing, card de historial de movimientos (lista simple, sin
// paginación — mismo criterio que el historial de cuenta).
export function SavingsGoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>()
  const { goal, movements, refetch } = useSavingsGoal(goalId)
  const [editOpen, setEditOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  // El chip "Savings" del modal global de transacciones (abierto desde aquí vía openAddTransaction,
  // o desde cualquier otro punto de la app) no conoce el `refetch` de esta página — suscribirse
  // evita que el detalle quede desactualizado tras una aportación hasta que el usuario recargue.
  const { openAddTransaction, subscribe } = useAddTransaction()
  useEffect(() => subscribe(refetch), [subscribe, refetch])

  if (goal === undefined) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (goal === null) {
    return <EmptyState icon={SearchRemoveIcon} title="Goal not found" />
  }

  async function handleReactivate() {
    if (!goalId) return
    await supabase.from('savings_goals').update({ status: 'active' }).eq('id', goalId).eq('status', 'archived')
    refetch()
  }

  const aportado = computeMontoAportadoActual(goal, movements)
  const percent = computePercent(aportado, goal.monto_objetivo)
  const restante = computeMontoRestante(aportado, goal.monto_objetivo)
  const monthsRemaining = computeMonthsRemaining(goal.fecha_limite)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-3xl">
            {goal.emoji}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-medium text-foreground">{goal.nombre}</h1>
              {goal.status === 'archived' && <Badge variant="secondary">Archived</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(goal.monto_objetivo)} target
              {goal.fecha_limite && ` · by ${new Date(goal.fecha_limite).toLocaleDateString()}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {goal.status === 'active' && (
            <>
              <Button
                onClick={() => openAddTransaction(undefined, { chip: 'goal_contribution', goalId: goal.id })}
              >
                Contribute
              </Button>
              <Button variant="outline" onClick={() => setWithdrawOpen(true)}>
                Withdraw
              </Button>
            </>
          )}
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          {goal.status === 'active' ? (
            <ArchiveGoalDialog goalId={goal.id} onArchived={refetch} />
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
              <p className="text-xs text-muted-foreground">Saved</p>
              <p className="font-mono text-lg text-card-foreground">{formatCurrency(aportado)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Target</p>
              <p className="font-mono text-lg text-card-foreground">{formatCurrency(goal.monto_objetivo)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="font-mono text-lg text-card-foreground">{formatCurrency(restante)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Time left</p>
              <p className="text-lg text-card-foreground">
                {monthsRemaining !== null ? `${monthsRemaining} mo` : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement history</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          {movements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No movements yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {movements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-card-foreground">{TRANSACTION_TYPE_LABELS[movement.tipo]}</p>
                    <p className="text-xs text-muted-foreground">
                      {movement.account?.nombre ?? 'Unknown account'} ·{' '}
                      {new Date(movement.fecha).toLocaleDateString()}
                    </p>
                  </div>
                  <MovementAmount monto={movement.monto} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <SavingsGoalFormDialog
        mode="edit"
        goal={goal}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => refetch()}
      />
      <WithdrawGoalDialog goal={goal} open={withdrawOpen} onOpenChange={setWithdrawOpen} onSuccess={refetch} />
    </div>
  )
}
