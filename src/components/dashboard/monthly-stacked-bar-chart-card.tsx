import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { format, parse } from 'date-fns'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

export interface MonthlyChartSeries {
  id: string
  label: string
  color: string
}

export interface MonthlyChartPoint {
  mes: string
  [seriesId: string]: string | number
}

// CU-062/CU-064 — barras apiladas por mes, una serie por cuenta/tarjeta, con navegación de año
// (RN-232/RN-240). Componente de `shadcn/ui` (chart-bar-stacked) sobre los primitivos de
// `@/components/ui/chart` ya instalados para el módulo Reportes.
export function MonthlyStackedBarChartCard({
  title,
  description,
  data,
  series,
  anio,
  anioMinimo,
  anioMaximo,
  onChangeAnio,
}: {
  title: string
  description: string
  data: MonthlyChartPoint[]
  series: MonthlyChartSeries[]
  anio: number
  anioMinimo: number
  anioMaximo: number
  onChangeAnio: (anio: number) => void
}) {
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.id, { label: s.label, color: s.color }]))
  const chartData = data.map((point) => ({
    ...point,
    mesLabel: format(parse(point.mes, 'yyyy-MM', new Date()), 'MMM'),
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon-sm"
            disabled={anio <= anioMinimo}
            onClick={() => onChangeAnio(anio - 1)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} />
          </Button>
          <span className="text-sm font-medium text-foreground">{anio}</span>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={anio >= anioMaximo}
            onClick={() => onChangeAnio(anio + 1)}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {series.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-56 w-full">
            <BarChart data={chartData}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {series.map((s) => (
                <Bar key={s.id} dataKey={s.id} stackId="stack" fill={`var(--color-${s.id})`} />
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
