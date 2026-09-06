import { differenceInCalendarDays } from 'date-fns'

import { SubscriptionAvatar } from '@/components/subscriptions/subscription-avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounts'
import { formatDate } from '@/lib/dates'
import type { UpcomingCharge } from '@/lib/subscriptions'

// "Hoy" y "Mañana" se leen más rápido que una fecha cuando el cobro es inminente, que es justo
// cuando importa alcanzar a cancelar.
function relativeLabel(fecha: Date, today: Date): string {
  const days = differenceInCalendarDays(fecha, today)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

// CU-079 — los cobros de los próximos 30 días. El calendario ya los contiene, pero ahí hay que
// buscarlos con la vista; esta es la pregunta que uno realmente le hace a un tracker de
// suscripciones. Las pruebas gratuitas se marcan porque son el caso donde no ver el cobro a tiempo
// cuesta dinero.
export function UpcomingChargesCard({
  charges,
  today,
}: {
  charges: UpcomingCharge[]
  today: Date
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Next 30 days</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {charges.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing due in the next 30 days.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {charges.map(({ subscription, fecha }) => (
              <div
                key={`${subscription.id}-${fecha.toISOString()}`}
                className="flex items-center gap-3 py-3"
              >
                <SubscriptionAvatar subscription={subscription} className="size-8" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm text-card-foreground">{subscription.nombre}</p>
                    {subscription.es_prueba && <Badge variant="secondary">Trial</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {relativeLabel(fecha, today)} · {formatDate(fecha)}
                  </p>
                </div>
                <p className="shrink-0 font-mono text-sm text-card-foreground">
                  {formatCurrency(subscription.monto)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
