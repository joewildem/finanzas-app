import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { format, parse } from 'date-fns'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

import { formatCurrency, formatCurrencyCompact } from '@/lib/accounts'
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

// Tick de dos renglones: el mes y, debajo, el total de ese mes. El total vive en el eje y no encima
// de la barra a propósito — colgado de la barra se movía de altura en cada mes y la lectura saltaba;
// anclado al eje queda en una sola línea horizontal y además no roba alto al área de dibujo. Va
// abreviado (`$34.5K`) porque doce meses no dejan ancho para la cifra completa; la exacta está en el
// tooltip. En cero no se imprime nada: un mes sin movimiento no necesita decir "$0".
function MonthTotalTick({
  x,
  y,
  index,
  payload,
  totales,
}: {
  x?: number
  y?: number
  index?: number
  payload?: { value?: string | number }
  totales: number[]
}) {
  // `index` lo inyecta recharts al clonar este elemento por cada tick, y es la vía para encontrar a
  // qué mes corresponde: el `payload` del eje solo trae la etiqueta ("Mar"), que se repetiría si
  // alguna vez hubiera dos años en la misma gráfica.
  const total = index === undefined ? undefined : totales[index]

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text dy={12} textAnchor="middle" fontSize={12} className="fill-muted-foreground">
        {payload?.value}
      </text>
      {total ? (
        <text dy={28} textAnchor="middle" fontSize={11} className="fill-foreground font-mono">
          {formatCurrencyCompact(total)}
        </text>
      ) : null}
    </g>
  )
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
  // Cada serie se normaliza a número, incluso cuando el mes no trae ese dato, para que ningún mes
  // quede fuera del total por una ausencia. El total se calcula aquí, sobre las mismas series que se
  // dibujan, de modo que no pueda desviarse de lo que muestra la barra: una cuenta excluida no
  // aparece en `series`, así que tampoco entra en la suma sin tener que recordar descontarla.
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
  const totales = chartData.map((point) => point.total)

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
              {/* El alto del eje se fija a mano porque el tick trae dos renglones y el de recharts
                  está calculado para uno solo. */}
              <XAxis
                dataKey="mesLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={0}
                height={44}
                interval={0}
                tick={<MonthTotalTick totales={totales} />}
              />
              {/* El tooltip es el lugar de la cifra exacta: aquí sí a dos decimales y con signo de
                  moneda, incluido el `$0.00` de una cuenta sin movimiento ese mes — un "0" suelto no
                  se distinguía de cualquier otro número de la lista. */}
              <ChartTooltip content={<ChartTooltipContent valueFormatter={formatCurrency} totalLabel="Total" />} />
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
