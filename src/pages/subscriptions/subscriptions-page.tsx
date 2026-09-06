import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { endOfMonth, endOfYear, format, parse, startOfMonth, startOfYear } from 'date-fns'

import { CategoryBreakdownCard, type CategoryBreakdownRow } from '@/components/subscriptions/category-breakdown-card'
import { MonthlyEvolutionCard, type MonthlyEvolutionPoint } from '@/components/subscriptions/monthly-evolution-card'
import { SubscriptionCalendarCard } from '@/components/subscriptions/subscription-calendar-card'
import { SubscriptionCard } from '@/components/subscriptions/subscription-card'
import { SubscriptionFormDialog } from '@/components/subscriptions/subscription-form-dialog'
import { SubscriptionsDrawer } from '@/components/subscriptions/subscriptions-drawer'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSubscriptionPayments } from '@/hooks/use-subscription-payments'
import { useSubscriptions } from '@/hooks/use-subscriptions'
import { formatCurrency } from '@/lib/accounts'
import { currentMonthKey, monthKeyLabel, shiftMonthKey } from '@/lib/budgets'
import {
  computeChargedInRange,
  computeMonthlyNormalized,
  computeMonthStatus,
  computeOccurrences,
  isLiveInRange,
  SUBSCRIPTION_CATEGORY_COLORS,
  SUBSCRIPTION_CATEGORY_LABELS,
  type MonthStatus,
  type Subscription,
  type SubscriptionCategory,
} from '@/lib/subscriptions'
import { cn } from '@/lib/utils'

type SortKey = 'due' | 'amount' | 'name'

const SORT_LABELS: Record<SortKey, string> = {
  due: 'Next charge',
  amount: 'Annual cost',
  name: 'Name',
}

function SummaryCard({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string
  value: string
  hint?: string
  valueClassName?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('font-mono text-2xl font-medium text-card-foreground', valueClassName)}>{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

// CU-079 — pantalla única del módulo. Un solo navegador de mes gobierna todo lo que se ve: las
// cuatro cards, el listado, las dos gráficas y el calendario. La alternativa —un selector de año
// para las gráficas y un mes propio para el calendario— dejaba cuatro nociones de tiempo
// conviviendo en la misma pantalla, y con ellas la posibilidad de que dos bloques hablaran de
// periodos distintos sin avisar.
//
// El listado muestra **solo lo que cobra en el mes visible**, no todo lo contratado: una anual
// aparece únicamente en su mes de cobro. El inventario completo vive en el panel lateral de "View
// all", que es donde tiene sentido preguntarse qué se tiene en total.
export function SubscriptionsPage() {
  const { subscriptions, refetch } = useSubscriptions()
  const [mes, setMes] = useState(currentMonthKey())
  const [addOpen, setAddOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('due')

  // Estable durante la vida de la pantalla: "hoy" no debe moverse entre renders, o el calendario y
  // las fechas de cobro podrían discrepar a medianoche.
  const today = useMemo(() => new Date(), [])

  const all = useMemo(() => subscriptions ?? [], [subscriptions])

  const { monthStart, monthEnd, yearStart, yearEnd, anio } = useMemo(() => {
    const date = parse(mes, 'yyyy-MM', new Date())
    return {
      monthStart: startOfMonth(date),
      monthEnd: endOfMonth(date),
      yearStart: startOfYear(date),
      yearEnd: endOfYear(date),
      anio: date.getFullYear(),
    }
  }, [mes])

  const { paid, setPaid } = useSubscriptionPayments(monthStart, monthEnd)

  // El listado son las que tienen al menos un cobro en el mes visible, con su estado de pago ya
  // resuelto: la card necesita saber cuál es el siguiente pendiente y cuántos van.
  const delMes = useMemo(() => {
    const vacio: ReadonlySet<string> = new Set()
    return all
      .map((subscription) => ({
        subscription,
        status: computeMonthStatus(subscription, monthStart, monthEnd, paid ?? vacio),
      }))
      .filter((entry) => entry.status.charges.length > 0)
  }, [all, monthStart, monthEnd, paid])

  const chargedThisMonth = useMemo(
    () => computeChargedInRange(all, monthStart, monthEnd),
    [all, monthStart, monthEnd],
  )
  const chargedThisYear = useMemo(
    () => computeChargedInRange(all, yearStart, yearEnd),
    [all, yearStart, yearEnd],
  )
  const normalizedMonthly = useMemo(
    () =>
      all
        .filter((sub) => isLiveInRange(sub, monthStart, monthEnd))
        .reduce((sum, sub) => sum + computeMonthlyNormalized(sub), 0),
    [all, monthStart, monthEnd],
  )
  const pendingThisMonth = useMemo(
    () => delMes.reduce((sum, entry) => sum + entry.status.pendingAmount, 0),
    [delMes],
  )

  const categoryRows = useMemo<CategoryBreakdownRow[]>(() => {
    const totals = new Map<SubscriptionCategory, number>()
    for (const sub of all) {
      const charged = computeOccurrences(sub, monthStart, monthEnd).length * sub.monto
      if (charged === 0) continue
      totals.set(sub.categoria, (totals.get(sub.categoria) ?? 0) + charged)
    }
    return [...totals.entries()]
      .map(([categoria, monto]) => ({
        categoria,
        nombre: SUBSCRIPTION_CATEGORY_LABELS[categoria],
        monto,
        color: SUBSCRIPTION_CATEGORY_COLORS[categoria],
      }))
      .sort((a, b) => b.monto - a.monto)
  }, [all, monthStart, monthEnd])

  const evolutionPoints = useMemo<MonthlyEvolutionPoint[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const date = new Date(anio, i, 1)
        return {
          mesLabel: format(date, 'MMM'),
          monto: computeChargedInRange(all, startOfMonth(date), endOfMonth(date)),
        }
      }),
    [all, anio],
  )

  const sorted = useMemo(() => {
    const rows = [...delMes]
    if (sortBy === 'amount') {
      rows.sort((a, b) => computeMonthlyNormalized(b.subscription) - computeMonthlyNormalized(a.subscription))
    } else if (sortBy === 'name') {
      rows.sort((a, b) => a.subscription.nombre.localeCompare(b.subscription.nombre))
    } else {
      // Por el **primer** cobro del mes, no por el siguiente pendiente. Es deliberado: ordenar por
      // el pendiente hace que marcar una casilla mueva la card de lugar, y en una semanal con cuatro
      // cargos la card salta en cada clic. El orden tiene que ser estable frente a lo que el usuario
      // marca; lo que cambia al marcar es el aspecto de la card, no su posición.
      rows.sort((a, b) => {
        const diff = a.status.charges[0].getTime() - b.status.charges[0].getTime()
        return diff !== 0 ? diff : a.subscription.nombre.localeCompare(b.subscription.nombre)
      })
    }
    return rows
  }, [delMes, sortBy])

  const mesLabel = monthKeyLabel(mes)
  const mesLabelCorto = format(parse(mes, 'yyyy-MM', new Date()), 'MMM')

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium text-foreground">Subscriptions</h1>
            <p className="text-sm text-muted-foreground">Track what you pay for and when it renews.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setMes(shiftMonthKey(mes, -1))}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium text-foreground">{mesLabel}</span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setMes(shiftMonthKey(mes, 1))}
            >
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
            <Button onClick={() => setAddOpen(true)}>Add subscription</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label={`Charged in ${mesLabel}`}
            value={formatCurrency(chargedThisMonth)}
            hint={`${formatCurrency(normalizedMonthly)}/mo on average`}
          />
          <SummaryCard
            label="Left to pay"
            value={formatCurrency(pendingThisMonth)}
            hint={pendingThisMonth === 0 ? 'Everything is settled' : `of ${formatCurrency(chargedThisMonth)}`}
            valueClassName={pendingThisMonth === 0 ? 'text-success' : undefined}
          />
          <SummaryCard label={`Charged in ${anio}`} value={formatCurrency(chargedThisYear)} />
          <SummaryCard
            label="Active"
            value={String(all.filter((sub) => isLiveInRange(sub, monthStart, monthEnd)).length)}
            hint="subscriptions this month"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-foreground">Charged in {mesLabel}</h2>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => value && setSortBy(value as SortKey)}>
                <SelectTrigger className="w-44" aria-label="Sort subscriptions">
                  <SelectValue>{(value: SortKey) => `Sort by ${SORT_LABELS[value].toLowerCase()}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {SORT_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setDrawerOpen(true)}>
                View all
              </Button>
            </div>
          </div>

          {subscriptions === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sorted.length === 0 ? (
            <Card>
              <CardContent>
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nothing is charged this month.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map(({ subscription, status }: { subscription: Subscription; status: MonthStatus }) => (
                <SubscriptionCard
                  key={subscription.id}
                  subscription={subscription}
                  monthStatus={status}
                  today={today}
                  onTogglePaid={setPaid}
                  onChanged={refetch}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <CategoryBreakdownCard rows={categoryRows} monthLabel={mesLabel} />
          <MonthlyEvolutionCard points={evolutionPoints} anio={anio} mesLabelSeleccionado={mesLabelCorto} />
        </div>

        <SubscriptionCalendarCard mes={monthStart} subscriptions={all} today={today} />

        <SubscriptionsDrawer
          subscriptions={all}
          today={today}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
        <SubscriptionFormDialog mode="create" open={addOpen} onOpenChange={setAddOpen} onSuccess={refetch} />
      </div>
    </TooltipProvider>
  )
}
