import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Clock01Icon, MoreVerticalIcon } from '@hugeicons/core-free-icons'
import { format, parseISO } from 'date-fns'
import { Link } from 'react-router-dom'

import { ArchiveDebtDialog } from '@/components/debts/archive-debt-dialog'
import { DebtFormDialog } from '@/components/debts/debt-form-dialog'
import { DebtPaymentDialog } from '@/components/debts/debt-payment-dialog'
import { GoalProgressRing } from '@/components/savings/goal-progress-ring'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/accounts'
import {
  computeMonthsRemaining,
  computePercentPagado,
  computeSaldoActual,
  DEBT_TYPE_ICONS,
  type Debt,
} from '@/lib/debts'
import { supabase } from '@/lib/supabase'
import { formatPercent } from '@/lib/utils'

// CU-056 — card de listado, mismo layout que SavingsGoalCard: header (ícono por tipo + nombre +
// menú de acciones), pill de fecha estimada de liquidación, fila principal (saldo + "from
// {monto_original}" a la izquierda, anillo de % pagado a la derecha), separador, fila de cierre
// (restante + meses restantes). Stretched link en el nombre para navegar al detalle sin anidar
// elementos interactivos.
export function DebtCard({
  debt,
  capitalPagos,
  onChanged,
}: {
  debt: Debt
  capitalPagos: number[]
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const saldoActual = computeSaldoActual(debt, capitalPagos)
  const percent = computePercentPagado(saldoActual, debt.monto_original)
  const monthsRemaining = computeMonthsRemaining(debt.fecha_liquidacion_estimada)

  async function handleReactivate() {
    await supabase.from('debts').update({ status: 'active' }).eq('id', debt.id).eq('status', 'archived')
    onChanged()
  }

  return (
    <Card className={`relative ${debt.status === 'archived' ? 'opacity-60' : ''}`}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <HugeiconsIcon icon={DEBT_TYPE_ICONS[debt.tipo]} className="size-5" />
            </span>
            <Link
              to={`/debts/${debt.id}`}
              className="truncate font-medium text-card-foreground outline-none focus-visible:underline"
            >
              <span className="absolute inset-0" aria-hidden="true" />
              {debt.nombre}
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10 shrink-0"
                  aria-label="Debt actions"
                />
              }
            >
              <HugeiconsIcon icon={MoreVerticalIcon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {debt.status === 'active' && (
                <DropdownMenuItem onClick={() => setPaymentOpen(true)}>Register payment</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              {debt.status === 'active' ? (
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>Archive</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleReactivate}>Reactivate</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {debt.fecha_liquidacion_estimada && (
          <div className="flex w-fit items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
            {format(parseISO(debt.fecha_liquidacion_estimada), 'MMM d, yyyy')}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <p className="font-mono text-2xl font-medium text-card-foreground">
              {formatCurrency(saldoActual)}{' '}
              <span className="font-sans text-sm font-normal text-muted-foreground">left</span>
            </p>
            <p className="text-xs text-muted-foreground">from {formatCurrency(debt.monto_original)}</p>
          </div>
          <GoalProgressRing percent={percent} size={64} strokeWidth={6}>
            <span className="text-sm font-medium text-card-foreground">{formatPercent(percent * 100)}</span>
          </GoalProgressRing>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-sm">
            <span className="font-mono font-medium text-card-foreground">{formatCurrency(saldoActual)}</span>{' '}
            <span className="text-muted-foreground">remaining</span>
          </p>
          {monthsRemaining !== null && (
            <p className="text-xs text-muted-foreground">{monthsRemaining} months left</p>
          )}
        </div>
      </CardContent>

      <DebtFormDialog mode="edit" debt={debt} open={editOpen} onOpenChange={setEditOpen} onSuccess={() => onChanged()} />
      <ArchiveDebtDialog debtId={debt.id} open={archiveOpen} onOpenChange={setArchiveOpen} onArchived={onChanged} />
      <DebtPaymentDialog debt={debt} open={paymentOpen} onOpenChange={setPaymentOpen} onSuccess={onChanged} />
    </Card>
  )
}
