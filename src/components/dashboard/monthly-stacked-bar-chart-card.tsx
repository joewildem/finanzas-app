import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { format, parse } from 'date-fns'
import { Bar, BarChart, CartesianGrid, LabelList, XAxis } from 'recharts'

import { formatCurrencyCompact } from '@/lib/accounts'
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
  // Cada serie se normaliza a número, incluso cuando el mes no trae ese dato: la etiqueta del total
  // cuelga de la última barra del apilado, y si esa serie llegara ausente en algún mes el apilado no
  // tendría cima donde colocarla y ese mes se quedaría sin etiqueta. El total se calcula aquí, sobre
  // las mismas series que se dibujan, para que no pueda desviarse de la altura de la barra.
  const chartData = data.map((point) => {
    const valores: number[] = series.map((s) => {
      const valor = point[s.id]
      return typeof valor === 'number' ? valor : 0
    })
    return {
      ...point,
      ...Object.fromEntries(series.map((s, index) => [s.id, valores[index]])),
      total: valores.reduce((sum, valor) => sum + valor, 0),
      mesLabel: format(parse(point.mes, 'yyyy-MM', new Date()), 'MMM'),
    }
  })

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
            {/* El margen superior se abre para la etiqueta del total: la barra más alta llega al
                borde del área de dibujo y su etiqueta quedaría cortada. Los otros tres lados
                conservan el valor que recharts trae por omisión, porque pasar `margin` lo
                reemplaza completo en vez de mezclarlo. */}
            <BarChart data={chartData} margin={{ top: 24, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {series.map((s, index) => (
                <Bar key={s.id} dataKey={s.id} stackId="stack" fill={`var(--color-${s.id})`}>
                  {/* El total del mes, encima de la barra: el tooltip ya desglosa por cuenta, pero
                      eso obliga a posar el cursor en cada mes para comparar dos. La etiqueta va en
                      la última serie del apilado porque es la que queda arriba. Abreviada
                      (`$94.5K`) porque doce meses no dejan ancho para la cifra completa, y en cero
                      se omite: un mes sin movimiento no necesita decir "$0". */}
                  {index === series.length - 1 && (
                    <LabelList
                      dataKey="total"
                      position="top"
                      offset={8}
                      className="fill-muted-foreground"
                      fontSize={11}
                      formatter={(value) =>
                        typeof value === 'number' && value !== 0 ? formatCurrencyCompact(value) : ''
                      }
                    />
                  )}
                </Bar>
              ))}
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
