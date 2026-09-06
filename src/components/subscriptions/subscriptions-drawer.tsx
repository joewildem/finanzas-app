import { SubscriptionAvatar } from '@/components/subscriptions/subscription-avatar'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { formatCurrency } from '@/lib/accounts'
import { formatDate } from '@/lib/dates'
import {
  computeNextCharge,
  SUBSCRIPTION_CATEGORY_LABELS,
  SUBSCRIPTION_CYCLE_LABELS,
  type Subscription,
} from '@/lib/subscriptions'

// CU-079 — el listado completo, incluidas las que no cobran en el mes visible y las archivadas. La
// pantalla principal muestra solo lo que se paga este mes; esto es la vista de inventario, para
// responder "¿qué tengo contratado en total?" sin llenar la pantalla de cosas que no cobran hoy.
export function SubscriptionsDrawer({
  subscriptions,
  today,
  open,
  onOpenChange,
}: {
  subscriptions: Subscription[]
  today: Date
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const activas = subscriptions.filter((sub) => sub.status === 'active')
  const archivadas = subscriptions.filter((sub) => sub.status === 'archived')

  function renderRow(sub: Subscription) {
    const next = sub.status === 'active' ? computeNextCharge(sub, today) : null

    return (
      <div key={sub.id} className="flex items-center gap-3 py-3">
        <SubscriptionAvatar subscription={sub} className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm text-popover-foreground">{sub.nombre}</p>
            {sub.es_prueba && <Badge variant="secondary">Trial</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {SUBSCRIPTION_CATEGORY_LABELS[sub.categoria]} · {SUBSCRIPTION_CYCLE_LABELS[sub.ciclo]}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-popover-foreground">{formatCurrency(sub.monto)}</p>
          <p className="text-xs text-muted-foreground">
            {next ? formatDate(next) : sub.status === 'archived' ? 'Archived' : 'No more charges'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>All subscriptions</DrawerTitle>
          <DrawerDescription>
            {activas.length} active
            {archivadas.length > 0 ? ` · ${archivadas.length} archived` : ''}
          </DrawerDescription>
        </DrawerHeader>

        {subscriptions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="flex flex-col">
            <div className="flex flex-col divide-y divide-border">{activas.map(renderRow)}</div>

            {archivadas.length > 0 && (
              <>
                <p className="pt-5 pb-1 text-xs font-medium text-muted-foreground">Archived</p>
                <div className="flex flex-col divide-y divide-border opacity-60">
                  {archivadas.map(renderRow)}
                </div>
              </>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
