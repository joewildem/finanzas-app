import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreVerticalIcon } from '@hugeicons/core-free-icons'

import { ArchiveSubscriptionDialog } from '@/components/subscriptions/archive-subscription-dialog'
import { SubscriptionAvatar } from '@/components/subscriptions/subscription-avatar'
import { SubscriptionFormDialog } from '@/components/subscriptions/subscription-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/accounts'
import { formatDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'
import {
  computeAnnualized,
  relativeDayLabel,
  SUBSCRIPTION_CATEGORY_LABELS,
  SUBSCRIPTION_CYCLE_SUFFIX,
  type MonthStatus,
  type Subscription,
} from '@/lib/subscriptions'
import { cn } from '@/lib/utils'

// CU-079 / CU-083 — card de una suscripción que cobra en el mes visible. Junto al monto va el costo
// anualizado, que es el número que hace evidente qué vale la pena cancelar: "$139.00/mo" se lee
// barato, "$1,668.00/yr" no. Un pago único no tiene equivalente anual, así que ahí se omite.
//
// Al pie, la fecha del próximo cobro pendiente del mes y la casilla para marcarlo pagado. La casilla
// avanza cobro por cobro y no mes por mes: una suscripción semanal tiene cuatro cargos en el mes, y
// marcarlos todos de golpe al primer clic diría que ya se pagó algo que aún no ocurre.
export function SubscriptionCard({
  subscription,
  monthStatus,
  today,
  onTogglePaid,
  onChanged,
}: {
  subscription: Subscription
  monthStatus: MonthStatus
  today: Date
  onTogglePaid: (subscriptionId: string, fecha: Date, paid: boolean) => void
  onChanged: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  const anualizado = computeAnnualized(subscription)
  const isArchived = subscription.status === 'archived'

  const { charges, pending, next } = monthStatus
  const allPaid = charges.length > 0 && pending.length === 0
  const paidCount = charges.length - pending.length

  async function handleReactivate() {
    await supabase
      .from('subscriptions')
      .update({ status: 'active', archivada_en: null })
      .eq('id', subscription.id)
      .eq('status', 'archived')
    onChanged()
  }

  function handleToggle() {
    // Marcar avanza al siguiente cobro pendiente; desmarcar retrocede al último que se dio por
    // pagado, no al primero — es el que se acaba de marcar por error.
    if (next) onTogglePaid(subscription.id, next, true)
    else if (charges.length > 0) onTogglePaid(subscription.id, charges[charges.length - 1], false)
  }

  const dueLabel = next ? relativeDayLabel(next, today) : null

  return (
    <Card className={cn('relative', isArchived && 'opacity-60')}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <SubscriptionAvatar subscription={subscription} />
            <div className="min-w-0">
              <p className="truncate font-medium text-card-foreground">{subscription.nombre}</p>
              <p className="truncate text-xs text-muted-foreground">
                {SUBSCRIPTION_CATEGORY_LABELS[subscription.categoria]}
                {subscription.metodo_pago ? ` · ${subscription.metodo_pago}` : ''}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10 shrink-0"
                  aria-label="Subscription actions"
                />
              }
            >
              <HugeiconsIcon icon={MoreVerticalIcon} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setEditOpen(true)}>Edit</DropdownMenuItem>
              {isArchived ? (
                <DropdownMenuItem onClick={handleReactivate}>Reactivate</DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => setArchiveOpen(true)}>Archive</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-h-6 items-end justify-between gap-2">
          <p className="font-mono text-xl font-medium text-card-foreground">
            {formatCurrency(subscription.monto)}
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {SUBSCRIPTION_CYCLE_SUFFIX[subscription.ciclo]}
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {subscription.es_prueba && <Badge variant="secondary">Trial</Badge>}
            {anualizado > 0 && (
              <p className="font-mono text-xs text-muted-foreground">{formatCurrency(anualizado)}/yr</p>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 border-t border-border pt-3">
          <Checkbox checked={allPaid} onCheckedChange={handleToggle} aria-label="Mark as paid" />
          <span className={cn('text-xs', allPaid ? 'text-success' : 'text-muted-foreground')}>
            {allPaid ? (
              'Paid'
            ) : (
              <>
                {dueLabel ? `${dueLabel} · ` : ''}
                {next ? formatDate(next) : '—'}
              </>
            )}
          </span>
          {charges.length > 1 && (
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {paidCount}/{charges.length}
            </span>
          )}
        </label>
      </CardContent>

      <SubscriptionFormDialog
        mode="edit"
        subscription={subscription}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onChanged}
      />
      <ArchiveSubscriptionDialog
        subscriptionId={subscription.id}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onArchived={onChanged}
      />
    </Card>
  )
}
