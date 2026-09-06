import { useMemo, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { endOfMonth, endOfYear, format, parse, startOfMonth, startOfYear } from 'date-fns'

import { CategoryBreakdownCard, type CategoryBreakdownRow } from '@/components/subscriptions/category-breakdown-card'
import { MonthlyEvolutionCard, type MonthlyEvolutionPoint } from '@/components/subscriptions/monthly-evolution-card'
import { SubscriptionCalendarCard } from '@/components/subscriptions/subscription-calendar-card'
import { SubscriptionCard } from '@/components/subscriptions/subscription-card'
import { SubscriptionFormDialog } from '@/components/subscriptions/subscription-form-dialog'
import { UpcomingChargesCard } from '@/components/subscriptions/upcoming-charges-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useSubscriptions } from '@/hooks/use-subscriptions'
import { formatCurrency } from '@/lib/accounts'
import { currentMonthKey, monthKeyLabel, shiftMonthKey } from '@/lib/budgets'
import {
  computeChargedInRange,
  computeMonthlyNormalized,
  computeOccurrences,
  computeUpcomingCharges,
  isLiveInRange,
  SUBSCRIPTION_CATEGORY_COLORS,
  SUBSCRIPTION_CATEGORY_LABELS,
  type Subscription,
  type SubscriptionCategory,
} from '@/lib/subscriptions'

const UPCOMING_DAYS = 30

type SortKey = 'name' | 'amount'

const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  amount: 'Annual cost',
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-2xl font-medium text-card-foreground">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

// CU-079 — pantalla única del módulo. Un solo navegador de mes gobierna todo lo que se ve: las tres
// cards, las dos gráficas y el calendario. La alternativa —un selector de año para las gráficas y
// un mes propio para el calendario— dejaba cuatro nociones de tiempo conviviendo en la misma
// pantalla, y con ellas la posibilidad de que dos bloques hablaran de periodos distintos sin avisar.
//
// "Next 30 days" es la única excepción, y a propósito: cuenta desde hoy, no desde el mes visible,
// porque la pregunta que responde ("¿qué me van a cobrar?") solo tiene sentido en presente.
export function SubscriptionsPage() {
  const { subscriptions, refetch } = useSubscriptions()
  const [mes, setMes] = useState(currentMonthKey())
  const [addOpen, setAddOpen] = useState(false)
  const [sortBy, setSortBy] = useState<SortKey>('name')

  // Estable durante la vida de la pantalla: "hoy" no debe moverse entre renders, o el calendario y
  // la lista de próximos cobros podrían discrepar a medianoche.
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

  // Las tres cards y el listado hablan del mes visible, incluidas las archivadas que todavía
  // estaban vivas entonces: navegar a enero muestra enero, no lo que está vigente hoy.
  const liveThisMonth = useMemo(
    () => all.filter((sub) => isLiveInRange(sub, monthStart, monthEnd)),
    [all, monthStart, monthEnd],
  )

  const chargedThisMonth = useMemo(
    () => computeChargedInRange(all, monthStart, monthEnd),
    [all, monthStart, monthEnd],
  )
  const chargedThisYear = useMemo(
    () => computeChargedInRange(all, yearStart, yearEnd),
    [all, yearStart, yearEnd],
  )
  const normalizedMonthly = useMemo(
    () => liveThisMonth.reduce((sum, sub) => sum + computeMonthlyNormalized(sub), 0),
    [liveThisMonth],
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

  const upcoming = useMemo(() => computeUpcomingCharges(all, today, UPCOMING_DAYS), [all, today])

  const sorted = useMemo(() => {
    const rows = [...liveThisMonth]
    if (sortBy === 'amount') {
      rows.sort((a, b) => computeMonthlyNormalized(b) - computeMonthlyNormalized(a))
    }
    return rows
  }, [liveThisMonth, sortBy])

  const mesLabel = monthKeyLabel(mes)
  const mesLabelCorto = format(parse(mes, 'yyyy-MM', new Date()), 'MMM')

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium text-foreground">Subscriptions</h1>
            <p className="text-sm text-muted-foreground">
              Track what you pay for and when it renews.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMes(shiftMonthKey(mes, -1))}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium text-foreground">{mesLabel}</span>
            <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMes(shiftMonthKey(mes, 1))}>
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
            <Button onClick={() => setAddOpen(true)}>Add subscription</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label={`Charged in ${mesLabel}`}
            value={formatCurrency(chargedThisMonth)}
            hint={`${formatCurrency(normalizedMonthly)}/mo on average`}
          />
          <SummaryCard label={`Charged in ${anio}`} value={formatCurrency(chargedThisYear)} />
          <SummaryCard
            label="Active"
            value={String(sorted.length)}
            hint={sorted.length === 1 ? 'subscription' : 'subscriptions'}
          />
        </div>

        <UpcomingChargesCard charges={upcoming} today={today} />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium text-foreground">Active in {mesLabel}</h2>
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
          </div>

          {subscriptions === undefined ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sorted.length === 0 ? (
            <Card>
              <CardContent>
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No subscriptions for this month yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sorted.map((subscription: Subscription) => (
                <SubscriptionCard key={subscription.id} subscription={subscription} onChanged={refetch} />
              ))}
            </div>
          )}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <CategoryBreakdownCard rows={categoryRows} monthLabel={mesLabel} />
          <MonthlyEvolutionCard points={evolutionPoints} anio={anio} mesLabelSeleccionado={mesLabelCorto} />
        </div>

        <SubscriptionCalendarCard mes={monthStart} subscriptions={all} today={today} />

        <SubscriptionFormDialog
          mode="create"
          open={addOpen}
          onOpenChange={setAddOpen}
          onSuccess={refetch}
        />
      </div>
    </TooltipProvider>
  )
}
