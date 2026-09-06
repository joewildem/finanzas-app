import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/accounts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

const BAR_ROW_HEIGHT = 34
const MIN_CHART_HEIGHT = 140

export interface CategoryBreakdownRow {
  categoria: string
  nombre: string
  monto: number
  color: string
}

// CU-079 — recapitulación del gasto del mes visible por categoría, en barras horizontales. Mismo
// componente base que AnalyticsGroupDistributionCard, con una diferencia: aquí cada barra lleva el
// color fijo de su categoría (vía `Cell`) en vez de un color único para toda la serie, porque la
// categoría es la dimensión que se compara.
export function CategoryBreakdownCard({
  rows,
  monthLabel,
}: {
  rows: CategoryBreakdownRow[]
  monthLabel: string
}) {
  const chartConfig: ChartConfig = { monto: { label: 'Charged' } }
  const chartHeight = Math.max(rows.length * BAR_ROW_HEIGHT, MIN_CHART_HEIGHT)

  return (
    <Card>
      <CardHeader>
        <CardTitle>By category</CardTitle>
        <p className="text-sm text-muted-foreground">{monthLabel}</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No charges this month.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: chartHeight }}>
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="nombre" type="category" tickLine={false} axisLine={false} width={100} />
              <ChartTooltip content={<ChartTooltipContent valueFormatter={formatCurrency} />} />
              <Bar dataKey="monto" radius={4}>
                {rows.map((row) => (
                  <Cell key={row.categoria} fill={row.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
