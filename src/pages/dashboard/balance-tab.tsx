import { useMemo, useState } from 'react'
import { CreditCardIcon, Wallet01Icon } from '@hugeicons/core-free-icons'

import { AccountCardTile } from '@/components/accounts/account-card-tile'
import { AccountCarousel } from '@/components/dashboard/account-carousel'
import { CreditBalanceCard } from '@/components/dashboard/credit-balance-card'
import {
  MonthlyStackedBarChartCard,
  type MonthlyChartPoint,
} from '@/components/dashboard/monthly-stacked-bar-chart-card'
import { EmptyState } from '@/components/empty-state'
import { useAccounts } from '@/hooks/use-accounts'
import { useAccountsMonthlyBalance } from '@/hooks/use-accounts-monthly-balance'
import { useCreditCardsCycleSpend } from '@/hooks/use-credit-cards-cycle-spend'
import { useCreditCardsMonthlySpendHistory } from '@/hooks/use-credit-cards-monthly-spend-history'
import { formatCurrency } from '@/lib/accounts'
import { computeNavigableYearRange, sortByBalanceDesc, sortDebitCashAccounts } from '@/lib/dashboard'

const CURRENT_YEAR = new Date().getFullYear()

// CU-061 a CU-064 — pestaña Balance del Dashboard. Todo el cálculo es agregación en tiempo de
// consulta sobre `accounts`/`transactions` (sin backend propio, mismo patrón "Supabase directo" que
// el resto de la app) — una sola consulta de cuentas activas alimenta las cuatro secciones.
export function BalanceTab() {
  const { accounts } = useAccounts(false)
  const [anioBalance, setAnioBalance] = useState(CURRENT_YEAR)
  const [anioCredito, setAnioCredito] = useState(CURRENT_YEAR)

  const debitoEfectivo = useMemo(
    () => sortDebitCashAccounts((accounts ?? []).filter((a) => a.tipo === 'debito' || a.tipo === 'efectivo')),
    [accounts],
  )
  const credito = useMemo(
    () => sortByBalanceDesc((accounts ?? []).filter((a) => a.tipo === 'credito')),
    [accounts],
  )

  // RN-225
  const balanceTotal = debitoEfectivo
    .filter((a) => !a.excluir_de_stats)
    .reduce((sum, a) => sum + a.saldo_actual, 0)
  // RN-241
  const totalCreditCards = credito.reduce((sum, a) => sum + a.saldo_actual, 0)

  // RN-232/RN-240
  const rangoAnioBalance = computeNavigableYearRange(debitoEfectivo)
  const rangoAnioCredito = computeNavigableYearRange(credito)

  const { meses: mesesBalance } = useAccountsMonthlyBalance(anioBalance)
  const { meses: mesesCredito } = useCreditCardsMonthlySpendHistory(credito, anioCredito)
  const { spendByAccount: cycleSpendByAccount } = useCreditCardsCycleSpend(credito)

  const balanceChartData: MonthlyChartPoint[] = (mesesBalance ?? []).map((point) => {
    const row: MonthlyChartPoint = { mes: point.mes }
    for (const cuenta of point.cuentas) row[cuenta.account_id] = cuenta.balance ?? 0
    return row
  })
  const balanceChartSeries = debitoEfectivo.map((a) => ({ id: a.id, label: a.nombre, color: a.color }))

  const creditChartData: MonthlyChartPoint[] = (mesesCredito ?? []).map((point) => {
    const row: MonthlyChartPoint = { mes: point.mes }
    for (const tarjeta of point.tarjetas) row[tarjeta.account_id] = tarjeta.gasto
    return row
  })
  const creditChartSeries = credito.map((a) => ({ id: a.id, label: a.nombre, color: a.color }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-base font-medium text-muted-foreground">Total balance</p>
        <p className="font-mono text-2xl font-regular text-card-foreground">{formatCurrency(balanceTotal)}</p>
      </div>

      {debitoEfectivo.length === 0 ? (
        <EmptyState
          icon={Wallet01Icon}
          title="No debit or cash accounts yet"
          description="Add a debit or cash account to see your balance here."
        />
      ) : (
        <AccountCarousel
          items={debitoEfectivo}
          keyOf={(account) => account.id}
          renderItem={(account) => <AccountCardTile account={account} />}
        />
      )}

      {rangoAnioBalance && (
        <MonthlyStackedBarChartCard
          title="Monthly balance"
          description="Balance across the year"
          data={balanceChartData}
          series={balanceChartSeries}
          anio={anioBalance}
          anioMinimo={rangoAnioBalance.min}
          anioMaximo={rangoAnioBalance.max}
          onChangeAnio={setAnioBalance}
        />
      )}

      <div className="flex flex-col gap-2">
        <p className="text-base font-medium text-muted-foreground">Total credit cards</p>
        <p className="font-mono text-2xl font-regular text-card-foreground">{formatCurrency(totalCreditCards)}</p>
      </div>

      {credito.length === 0 ? (
        <EmptyState
          icon={CreditCardIcon}
          title="No credit cards yet"
          description="Add a credit card account to see it here."
        />
      ) : (
        <AccountCarousel
          items={credito}
          keyOf={(account) => account.id}
          renderItem={(account) => (
            <CreditBalanceCard account={account} cycleSpend={cycleSpendByAccount?.[account.id]} />
          )}
        />
      )}

      {rangoAnioCredito && (
        <MonthlyStackedBarChartCard
          title="Monthly usage"
          description="Usage across the year"
          data={creditChartData}
          series={creditChartSeries}
          anio={anioCredito}
          anioMinimo={rangoAnioCredito.min}
          anioMaximo={rangoAnioCredito.max}
          onChangeAnio={setAnioCredito}
        />
      )}
    </div>
  )
}
