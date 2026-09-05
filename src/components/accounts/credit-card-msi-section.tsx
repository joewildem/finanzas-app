import { Fragment, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, ChevronRightIcon, Tick01Icon } from '@hugeicons/core-free-icons'

import { AddMsiPurchaseDialog } from '@/components/accounts/add-msi-purchase-dialog'
import { DeleteMsiPurchaseDialog } from '@/components/accounts/delete-msi-purchase-dialog'
import { SettleMsiPlanDialog } from '@/components/accounts/settle-msi-plan-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency, type AccountTransaction } from '@/lib/accounts'
import { currentMonthKey, monthKeyLabel } from '@/lib/budgets'
import {
  computeChargedThrough,
  computeInstallmentForMonth,
  computeInstallmentSchedule,
  type MsiPlan,
} from '@/lib/msi'
import { cn } from '@/lib/utils'

function monthOf(fecha: string): string {
  return fecha.slice(0, 7)
}

// Lo que hay que pagarle a la tarjeta en un mes: las compras del periodo (excluyendo las compras a
// MSI, cuyo monto completo no se paga ese mes) más las mensualidades de los planes que corren ese
// mes. Es el mismo desglose de dos columnas que el usuario llevaba a mano en su hoja de cálculo, y
// cuadra con Presupuesto por construcción: ambos parten de la misma exclusión.
function buildMonthlyStatement(movements: AccountTransaction[], plans: MsiPlan[], mes: string) {
  // Solo gastos corrientes: una `compra_msi` es su propio tipo, así que este filtro ya la deja fuera
  // — su monto no se paga en el mes de la compra, se paga en parcialidades.
  const compras = movements
    .filter((m) => m.tipo === 'gasto' && monthOf(m.fecha) === mes)
    .reduce((sum, m) => sum + Math.abs(m.monto), 0)

  // Se conserva el desglose por plan, no solo la suma: es lo que se muestra al pasar el cursor sobre
  // el total de mensualidades del mes.
  const desglose = plans.flatMap((plan) => {
    const monto = computeInstallmentForMonth(plan, mes) ?? 0
    return monto > 0 ? [{ concepto: plan.concepto, monto }] : []
  })
  const mensualidades = desglose.reduce((sum, entry) => sum + entry.monto, 0)

  return {
    mes,
    compras,
    mensualidades,
    desglose,
    total: compras + mensualidades,
  }
}

export function CreditCardMsiSection({
  accountId,
  plans,
  movements,
  onChanged,
}: {
  accountId: string
  plans: MsiPlan[]
  movements: AccountTransaction[]
  onChanged: () => void
}) {
  const [openPlanId, setOpenPlanId] = useState<string | null>(null)
  const mesActual = currentMonthKey()
  const anioActual = Number(mesActual.slice(0, 4))
  const [anio, setAnio] = useState(anioActual)

  // Años navegables: desde el primero con movimientos o parcialidades hasta el último con una
  // parcialidad pendiente — mismo criterio que la gráfica de balance mensual, que solo deja moverse
  // por años que tienen algo que mostrar (RN-232/RN-240).
  const mesesConDatos = [
    ...movements.map((m) => monthOf(m.fecha)),
    ...plans.flatMap((plan) => computeInstallmentSchedule(plan).map((cuota) => cuota.mes)),
  ]
  const anios = mesesConDatos.map((mes) => Number(mes.slice(0, 4)))
  const anioMinimo = Math.min(anioActual, ...anios)
  const anioMaximo = Math.max(anioActual, ...anios)

  // Los doce meses del año elegido, siempre completos — que un mes salga en ceros también es
  // información (ese mes no debes nada).
  const mesesDelAnio = Array.from({ length: 12 }, (_, i) =>
    buildMonthlyStatement(movements, plans, `${anio}-${String(i + 1).padStart(2, '0')}`),
  )

  const totalComprometido = plans.reduce((sum, plan) => {
    const { monto } = computeChargedThrough(plan, mesActual)
    return sum + (Math.abs(plan.monto) - monto)
  }, 0)

  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Installment plans (MSI)</CardTitle>
          <AddMsiPurchaseDialog accountId={accountId} onCreated={onChanged} />
        </CardHeader>
        <CardContent>
          <p className="py-6 text-center text-sm text-muted-foreground">No installment plans yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    // Dos tarjetas hermanas, lado a lado a partir de `lg` y apiladas en pantallas menores: el
    // calendario de pagos y el avance de los planes son lecturas distintas, cada una en su contenedor.
    // `items-start` evita que la más corta se estire para igualar a la otra.
    <TooltipProvider>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Payment schedule</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Still owed on plans: <span className="font-mono">{formatCurrency(totalComprometido)}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={anio <= anioMinimo}
                onClick={() => setAnio(anio - 1)}
                aria-label="Previous year"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} />
              </Button>
              <span className="text-sm font-medium text-foreground">{anio}</span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={anio >= anioMaximo}
                onClick={() => setAnio(anio + 1)}
                aria-label="Next year"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="py-2 text-left font-normal">Month</th>
                    <th className="py-2 text-right font-normal">Purchases</th>
                    <th className="py-2 text-right font-normal">Installments</th>
                    <th className="py-2 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mesesDelAnio.map((entry) => (
                    <tr key={entry.mes} className={cn(entry.total === 0 && 'opacity-50')}>
                      <td className="py-2 text-card-foreground">
                        {monthKeyLabel(entry.mes)}
                        {entry.mes === mesActual && (
                          <span className="ml-2 text-xs text-muted-foreground">this month</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        {formatCurrency(entry.compras)}
                      </td>
                      <td className="py-2 text-right font-mono text-muted-foreground">
                        {entry.desglose.length === 0 ? (
                          formatCurrency(entry.mensualidades)
                        ) : (
                          <Tooltip>
                            {/* `underline decoration-dotted` como única señal de que hay algo que
                                  ver: el monto sigue leyéndose igual, pero se distingue de los meses
                                  sin planes, donde no hay nada que desglosar. */}
                            <TooltipTrigger
                              render={
                                <span className="cursor-default underline decoration-dotted underline-offset-4" />
                              }
                            >
                              {formatCurrency(entry.mensualidades)}
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="flex flex-col gap-1">
                                {entry.desglose.map((linea) => (
                                  <div
                                    key={linea.concepto}
                                    className="flex items-baseline justify-between gap-4"
                                  >
                                    <span className="text-muted-foreground">{linea.concepto}</span>
                                    <span className="font-mono text-popover-foreground">
                                      {formatCurrency(linea.monto)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono text-card-foreground">
                        {formatCurrency(entry.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Purchases exclude the full amount of installment purchases — those are counted month by month in
              the Installments column.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle>Installment plans (MSI)</CardTitle>
            <AddMsiPurchaseDialog accountId={accountId} onCreated={onChanged} />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {plans.map((plan) => {
                const schedule = computeInstallmentSchedule(plan)
                const { monto: pagado, mensualidades } = computeChargedThrough(plan, mesActual)
                const total = Math.abs(plan.monto)
                const isOpen = openPlanId === plan.id
                const avance = total > 0 ? Math.min(pagado / total, 1) : 0

                return (
                  <Fragment key={plan.id}>
                    <div className="flex flex-col gap-2 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenPlanId(isOpen ? null : plan.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <HugeiconsIcon
                            icon={ChevronRightIcon}
                            className={cn(
                              'size-4 shrink-0 text-muted-foreground transition-transform',
                              isOpen && 'rotate-90',
                            )}
                          />
                          <span className="truncate text-sm text-card-foreground">{plan.concepto}</span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="font-mono text-sm text-card-foreground">
                            {formatCurrency(total)}
                          </span>
                          <SettleMsiPlanDialog plan={plan} onSettled={onChanged} />
                          <AddMsiPurchaseDialog accountId={accountId} plan={plan} onCreated={onChanged} />
                          <DeleteMsiPurchaseDialog
                            transactionId={plan.id}
                            concepto={plan.concepto}
                            monto={total}
                            onDeleted={onChanged}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 pl-6">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${avance * 100}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {mensualidades} of {plan.meses} · {formatCurrency(pagado)} charged
                        </span>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="pb-3 pl-6">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-border">
                            {schedule.map((cuota) => {
                              const isSettled = cuota.status === 'settled'
                              const isCharged = !isSettled && cuota.mes <= mesActual
                              const isCurrent = cuota.mes === mesActual
                              return (
                                <tr key={cuota.index}>
                                  <td className="w-8 py-1.5 font-mono text-xs text-muted-foreground">
                                    {cuota.index}
                                  </td>
                                  <td className="py-1.5 text-xs text-muted-foreground">
                                    {monthKeyLabel(cuota.mes)}
                                  </td>
                                  <td
                                    className={cn(
                                      'py-1.5 text-right font-mono text-xs',
                                      isCharged ? 'text-card-foreground' : 'text-muted-foreground',
                                    )}
                                  >
                                    {formatCurrency(cuota.monto)}
                                  </td>
                                  <td className="w-24 py-1.5 text-right text-xs">
                                    {isCharged ? (
                                      <span
                                        className={cn(
                                          'inline-flex items-center gap-1',
                                          isCurrent ? 'text-brand' : 'text-muted-foreground',
                                        )}
                                      >
                                        <HugeiconsIcon icon={Tick01Icon} className="size-3.5" />
                                        charged
                                      </span>
                                    ) : isSettled ? (
                                      <span className="text-muted-foreground/60">settled</span>
                                    ) : (
                                      <span className="text-muted-foreground/60">pending</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
