import { useState } from 'react'
import { subMonths } from 'date-fns'

import { AnalyticsCashFlowChartCard } from '@/components/dashboard/analytics-cash-flow-chart-card'
import { AnalyticsGroupDistributionCard } from '@/components/dashboard/analytics-group-distribution-card'
import { AnalyticsPeriodSelector } from '@/components/dashboard/analytics-period-selector'
import { AnalyticsSummaryCard } from '@/components/dashboard/analytics-summary-card'
import { useAnalyticsCashFlow } from '@/hooks/use-analytics-cash-flow'
import { useAnalyticsCategoryDistribution } from '@/hooks/use-analytics-category-distribution'
import { useAnalyticsSummary } from '@/hooks/use-analytics-summary'
import type { PeriodAmount } from '@/lib/analytics'
import type { Period } from '@/lib/date-periods'

const EMPTY_AMOUNT: PeriodAmount = { monto: 0, montoAnterior: null, variacion: null }

// CU-069 a CU-071 — pestaña Analytics del Dashboard. Un solo segmentador de periodo (RN-261)
// gobierna las cuatro cards de resumen, la gráfica de Cash Flow y la cuadrícula de distribución
// por grupo.
export function AnalyticsTab() {
  const [periodo, setPeriodo] = useState<Period>('1m')
  const [customRange, setCustomRange] = useState(() => ({
    fechaInicio: subMonths(new Date(), 1),
    fechaFin: new Date(),
  }))

  const activeRange = periodo === 'custom' ? customRange : undefined
  const { summary } = useAnalyticsSummary(periodo, activeRange)
  const { meses } = useAnalyticsCashFlow(periodo, activeRange)
  const { distribucion } = useAnalyticsCategoryDistribution(periodo, activeRange)

  return (
    <div className="flex flex-col gap-6">
      <AnalyticsPeriodSelector
        periodo={periodo}
        onChangePeriodo={setPeriodo}
        customRange={customRange}
        onChangeCustomRange={setCustomRange}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsSummaryCard title="Income" amount={summary?.income ?? EMPTY_AMOUNT} />
        <AnalyticsSummaryCard title="Expenses" amount={summary?.expenses ?? EMPTY_AMOUNT} />
        <AnalyticsSummaryCard title="Savings" amount={summary?.savings ?? EMPTY_AMOUNT} />
        <AnalyticsSummaryCard title="Investment" amount={summary?.investment ?? EMPTY_AMOUNT} />
      </div>

      <AnalyticsCashFlowChartCard data={meses ?? []} />

      {/* RN-269 — la cuadrícula no crece en alto sin límite; el scroll vertical vive aquí, no en
          cada card individual. */}
      <div className="max-h-[720px] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(distribucion ?? []).map((group) => (
            <AnalyticsGroupDistributionCard key={group.groupId} group={group} />
          ))}
        </div>
      </div>
    </div>
  )
}
