import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis } from 'recharts'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

export interface MonthlyEvolutionPoint {
  mesLabel: string
  monto: number
}

const chartConfig: ChartConfig = {
  monto: { label: 'Charged', color: 'var(--chart-1)' },
}

// CU-079 — evolución del gasto mes a mes dentro del año visible. Los doce meses aparecen siempre,
// incluso los que no tienen cobros: una línea con huecos sugeriría que falta información, cuando lo
// que dice el dato es que ese mes no se pagó nada. El mes seleccionado se marca con una guía
// vertical para no perder de vista qué punto están describiendo las cards y la gráfica de al lado.
export function MonthlyEvolutionCard({
  points,
  anio,
  mesLabelSeleccionado,
}: {
  points: MonthlyEvolutionPoint[]
  anio: number
  mesLabelSeleccionado: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Month by month</CardTitle>
        <p className="text-sm text-muted-foreground">{anio}</p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <LineChart data={points} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ReferenceLine x={mesLabelSeleccionado} stroke="var(--border)" strokeDasharray="4 4" />
            <Line
              dataKey="monto"
              type="monotone"
              stroke="var(--color-monto)"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
