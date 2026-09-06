import {
  eachDayOfInterval,
  endOfMonth,
  getDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from 'date-fns'

import { SubscriptionAvatar } from '@/components/subscriptions/subscription-avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/accounts'
import { formatDate } from '@/lib/dates'
import { computeOccurrences, type Subscription } from '@/lib/subscriptions'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Cuántos logos caben en una celda antes de que empiecen a competir con el monto, que es el dato
// principal. A partir del quinto se resumen en un contador; el desglose completo sigue en el
// emergente al pasar el cursor.
const MAX_AVATARS = 4

interface DayCharges {
  date: Date
  subs: Subscription[]
  total: number
}

// Cuántas celdas vacías van antes del día 1 para que la semana empiece en lunes. `getDay` devuelve
// 0 para domingo, así que hay que rotar.
function leadingBlanks(monthStart: Date): number {
  return (getDay(monthStart) + 6) % 7
}

// CU-082 — calendario de solo lectura del mes visible. No es el `Calendar` de los formularios
// (react-day-picker, pensado para elegir una fecha): aquí cada día es una card con su propio
// contenido — punto, monto y el desglose al pasar el cursor — y nada es seleccionable.
export function SubscriptionCalendarCard({
  mes,
  subscriptions,
  today,
}: {
  mes: Date
  subscriptions: Subscription[]
  today: Date
}) {
  const monthStart = startOfMonth(mes)
  const monthEnd = endOfMonth(mes)

  // Un solo recorrido por suscripción para todo el mes, indexando por día — en vez de preguntar por
  // las ocurrencias de cada uno de los 30 días por separado.
  const byDay = new Map<number, DayCharges>()
  for (const day of eachDayOfInterval({ start: monthStart, end: monthEnd })) {
    byDay.set(day.getDate(), { date: day, subs: [], total: 0 })
  }
  for (const sub of subscriptions) {
    for (const fecha of computeOccurrences(sub, monthStart, monthEnd)) {
      const entry = byDay.get(fecha.getDate())
      if (!entry) continue
      entry.subs.push(sub)
      entry.total += sub.monto
    }
  }

  const days = [...byDay.values()]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment calendar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="pb-1 text-center text-xs font-medium text-muted-foreground">
              {weekday}
            </div>
          ))}

          {Array.from({ length: leadingBlanks(monthStart) }, (_, i) => (
            <div key={`blank-${i}`} />
          ))}

          {days.map((day) => {
            const isToday = isSameDay(day.date, today) && isSameMonth(day.date, mes)
            const hasCharges = day.subs.length > 0

            const cell = (
              <div
                className={cn(
                  'flex min-h-16 flex-col justify-between rounded-lg border p-1.5 transition-colors',
                  hasCharges ? 'border-border bg-muted/40' : 'border-transparent bg-muted/20',
                  isToday && 'border-success ring-1 ring-success',
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      'text-xs',
                      hasCharges ? 'font-medium text-card-foreground' : 'text-muted-foreground',
                      isToday && 'text-success',
                    )}
                  >
                    {day.date.getDate()}
                  </span>
                  {hasCharges && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-success" />}
                </div>
                {hasCharges && (
                  <div className="flex items-end justify-between gap-1">
                    <span className="min-w-0 truncate font-mono text-[11px] text-card-foreground">
                      {formatCurrency(day.total)}
                    </span>
                    {/* Los logos solo aparecen cuando la celda es lo bastante ancha para ellos. Con
                        siete columnas repartiéndose la pantalla, por debajo de `lg` no queda espacio
                        sin recortar el monto, y entre las dos cosas gana el monto. */}
                    <div className="hidden shrink-0 items-center gap-0.5 lg:flex">
                      {day.subs.slice(0, MAX_AVATARS).map((sub) => (
                        <SubscriptionAvatar key={sub.id} subscription={sub} className="size-4 rounded-[3px]" />
                      ))}
                      {day.subs.length > MAX_AVATARS && (
                        <span className="flex h-4 min-w-4 items-center justify-center rounded-[3px] bg-muted px-0.5 text-[9px] font-medium text-muted-foreground ring-1 ring-border">
                          +{day.subs.length - MAX_AVATARS}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )

            if (!hasCharges) return <div key={day.date.toISOString()}>{cell}</div>

            return (
              <Tooltip key={day.date.toISOString()}>
                <TooltipTrigger render={<div className="cursor-default" />}>{cell}</TooltipTrigger>
                <TooltipContent className="max-w-64">
                  <p className="mb-1.5 font-medium">{formatDate(day.date)}</p>
                  <div className="flex flex-col gap-1.5">
                    {day.subs.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <SubscriptionAvatar subscription={sub} className="size-5 rounded-md" />
                        <span className="min-w-0 flex-1 truncate">{sub.nombre}</span>
                        <span className="font-mono">{formatCurrency(sub.monto)}</span>
                      </div>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
