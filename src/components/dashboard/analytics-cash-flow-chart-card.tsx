import { format, parse } from 'date-fns'
import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { CashFlowPoint } from '@/hooks/use-analytics-cash-flow'

const chartConfig: ChartConfig = {
  income: { label: 'Income', color: '#22c55e' },
  expenses: { label: 'Expenses', color: '#ef4444' },
}

// CU-070 — RN-264 a RN-266. Dos líneas (Income/Expenses), granularidad siempre mensual; comparte
// el periodo seleccionado en la pestaña con CU-069/CU-071 (sin segmentador propio).
export function AnalyticsCashFlowChartCard({ data }: { data: CashFlowPoint[] }) {
  const chartData = data.map((point) => ({
    ...point,
    mesLabel: format(parse(point.mes, 'yyyy-MM', new Date()), 'MMM'),
  }))

  return (
    <Card>
      <CardHeader className="gap-1">
        <p className="text-xl font-semibold text-card-foreground">Cash Flow</p>
        <p className="text-sm text-muted-foreground">Income vs Expenses</p>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <LineChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="income" type="monotone" stroke="var(--color-income)" strokeWidth={2} dot={false} />
              <Line dataKey="expenses" type="monotone" stroke="var(--color-expenses)" strokeWidth={2} dot={false} />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
