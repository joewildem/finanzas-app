import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { GroupDistribution } from '@/hooks/use-analytics-category-distribution'

const BAR_ROW_HEIGHT = 36
const MIN_CHART_HEIGHT = 120

// CU-071 — RN-267 a RN-269. Barras horizontales de las categorías de un grupo, ordenadas por
// RN-268 (ya vienen ordenadas del hook); alto proporcional a la cantidad de categorías para que
// las barras no se aplasten — el scroll vertical vive en el contenedor de la cuadrícula completa
// (RN-269), no en cada card individual.
export function AnalyticsGroupDistributionCard({ group }: { group: GroupDistribution }) {
  const hasData = group.categorias.length > 0
  const chartConfig: ChartConfig = { monto: { label: group.nombre, color: group.color } }
  const chartHeight = Math.max(group.categorias.length * BAR_ROW_HEIGHT, MIN_CHART_HEIGHT)

  return (
    <Card>
      <CardHeader className="gap-1">
        <p className="text-lg font-semibold text-card-foreground">{group.nombre}</p>
        <p className="text-sm text-muted-foreground">Allocation summary</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: chartHeight }}>
            <BarChart data={group.categorias} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="nombre" type="category" tickLine={false} axisLine={false} width={110} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="monto" fill="var(--color-monto)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
