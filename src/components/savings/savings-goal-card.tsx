import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Clock01Icon, MoreVerticalIcon } from '@hugeicons/core-free-icons'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'

import { ArchiveGoalDialog } from '@/components/savings/archive-goal-dialog'
import { GoalProgressRing } from '@/components/savings/goal-progress-ring'
import { SavingsGoalFormDialog } from '@/components/savings/savings-goal-form-dialog'
import { WithdrawGoalDialog } from '@/components/savings/withdraw-goal-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/accounts'
import { useAddTransaction } from '@/lib/add-transaction-context'
import {
  computeMonthsRemaining,
  computeMontoAportadoActual,
  computeMontoRestante,
  computePercent,
  type SavingsGoal,
} from '@/lib/savings-goals'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/lib/transactions'
import { formatPercent } from '@/lib/utils'

// CU-043 — card de listado, estructura alineada a la referencia de diseño: header (emoji + nombre
// + menú de acciones), pill de fecha límite, fila principal (aportado + "from {objetivo}" a la
// izquierda, anillo de progreso a la derecha), separador, fila de cierre (restante + tiempo
// restante). El nombre es un <Link> cuyo `::before`-equivalente (un span absoluto) cubre toda la
// card ("stretched link") para que el click en cualquier punto navegue al detalle sin anidar
// elementos interactivos — el botón del menú va en un stacking context propio (relative z-10) para
// no competir con esa superficie de click.
export function SavingsGoalCard({
  goal,
  movimientos,
  onChanged,
}: {
  goal: SavingsGoal
  movimientos: Pick<Transaction, 'monto'>[]
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const { openAddTransaction } = useAddTransaction()

  const aportado = computeMontoAportadoActual(goal, movimientos)
  const percent = computePercent(aportado, goal.monto_objetivo)
  const restante = computeMontoRestante(aportado, goal.monto_objetivo)
  const monthsRemaining = computeMonthsRemaining(goal.fecha_limite)

  async function handleReactivate() {
    await supabase.from('savings_goals').update({ status: 'active' }).eq('id', goal.id).eq('status', 'archived')
    onChanged()
  }

  return (
    <Card className={`relative ${goal.status === 'archived' ? 'opacity-60' : ''}`}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
              {goal.emoji}
            </span>
            <Link
              to={`/savings/${goal.id}`}
              className="truncate font-medium text-card-foreground outline-none focus-visible:underline"
            >
              <span className="absolute inset-0" aria-hidden="true" />
              {goal.nombre}
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10 shrink-0"
                  aria-label="Goal actions"
                />
              }
            >
              <HugeiconsIcon icon={MoreVerticalIcon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {goal.status === 'active' && (
                <>
                  <DropdownMenuItem
                    onClick={() => openAddTransaction(undefined, { chip: 'goal_contribution', goalId: goal.id })}
                  >
                    Contribute
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setWithdrawOpen(true)}>Withdraw</DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              {goal.status === 'active' ? (
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>Archive</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleReactivate}>Reactivate</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {goal.fecha_limite && (
          <div className="flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
            {format(parseISO(goal.fecha_limite), 'MMM d, yyyy')}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-2xl font-medium text-card-foreground">
              {formatCurrency(aportado)}{' '}
              <span className="font-sans text-sm font-normal text-muted-foreground">saved</span>
            </p>
            <p className="text-xs text-muted-foreground">from {formatCurrency(goal.monto_objetivo)}</p>
          </div>
          <GoalProgressRing percent={percent} size={64} strokeWidth={6}>
            <span className="text-sm font-medium text-card-foreground">{formatPercent(percent * 100)}</span>
          </GoalProgressRing>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-sm">
            <span className="font-mono font-medium text-card-foreground">{formatCurrency(restante)}</span>{' '}
            <span className="text-muted-foreground">remaining</span>
          </p>
          {monthsRemaining !== null && (
            <p className="text-xs text-muted-foreground">{monthsRemaining} months left</p>
          )}
        </div>
      </CardContent>

      <SavingsGoalFormDialog
        mode="edit"
        goal={goal}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => onChanged()}
      />
      <ArchiveGoalDialog goalId={goal.id} open={archiveOpen} onOpenChange={setArchiveOpen} onArchived={onChanged} />
      <WithdrawGoalDialog goal={goal} open={withdrawOpen} onOpenChange={setWithdrawOpen} onSuccess={onChanged} />
    </Card>
  )
}
