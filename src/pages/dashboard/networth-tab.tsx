import { useState } from 'react'
import { subMonths } from 'date-fns'

import { NetworthBalanceDonutCard } from '@/components/dashboard/networth-balance-donut-card'
import { NetworthBreakdownCard } from '@/components/dashboard/networth-breakdown-card'
import { NetworthGoalCard } from '@/components/dashboard/networth-goal-card'
import { NetworthLineChartCard } from '@/components/dashboard/networth-line-chart-card'
import { useNetworthBreakdown } from '@/hooks/use-networth-breakdown'
import { useNetworthGoal } from '@/hooks/use-networth-goal'
import { useNetworthHistory } from '@/hooks/use-networth-history'
import { computeAssetsVsLiabilities, computeGoalProgress, type NetworthPeriod } from '@/lib/networth'

const EMPTY_GROUP = { total: 0, items: [] }

// CU-065 a CU-068 — pestaña Networth del Dashboard. Columna izquierda: desglose de Cash & Savings,
// Investments y Liabilities (CU-065). Columna derecha: histórico de Networth total (CU-066),
// comparativo Assets vs Liabilities (CU-067) y meta de Networth (CU-068).
export function NetworthTab() {
  const { breakdown } = useNetworthBreakdown()
  const { goal, save } = useNetworthGoal()

  const [periodo, setPeriodo] = useState<NetworthPeriod>('1m')
  const [customRange, setCustomRange] = useState(() => ({
    fechaInicio: subMonths(new Date(), 1),
    fechaFin: new Date(),
  }))
  const { meses } = useNetworthHistory(periodo, periodo === 'custom' ? customRange : undefined)

  const cashAndSavings = breakdown?.cashAndSavings ?? EMPTY_GROUP
  const investments = breakdown?.investments ?? EMPTY_GROUP
  const liabilities = breakdown?.liabilities ?? EMPTY_GROUP

  const { assets, liabilities: liabilitiesTotal } = computeAssetsVsLiabilities(
    cashAndSavings.total,
    investments.total,
    liabilities.total,
  )
  const networthActual = assets - liabilitiesTotal
  const { percentReal, percentCapped } = computeGoalProgress(networthActual, goal?.monto_objetivo ?? 0)

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-6">
        <NetworthBreakdownCard title="Cash & Savings" group={cashAndSavings} />
        <NetworthBreakdownCard title="Investments" group={investments} />
        <NetworthBreakdownCard title="Liabilities" group={liabilities} />
      </div>

      <div className="flex flex-col gap-6">
        <NetworthLineChartCard
          data={meses ?? []}
          periodo={periodo}
          onChangePeriodo={setPeriodo}
          customRange={customRange}
          onChangeCustomRange={setCustomRange}
        />

        <div className="flex flex-col gap-6 sm:flex-row">
          <NetworthBalanceDonutCard assets={assets} liabilities={liabilitiesTotal} />
          <NetworthGoalCard
            montoObjetivo={goal?.monto_objetivo ?? null}
            percentReal={percentReal}
            percentCapped={percentCapped}
            onSave={save}
          />
        </div>
      </div>
    </div>
  )
}
