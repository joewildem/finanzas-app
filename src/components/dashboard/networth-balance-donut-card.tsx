import { Cell, Pie, PieChart } from 'recharts'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { formatCurrency } from '@/lib/accounts'

const ASSETS_COLOR = '#4f46e5'
const LIABILITIES_COLOR = '#e11d48'

const chartConfig: ChartConfig = {
  assets: { label: 'Assets', color: ASSETS_COLOR },
  liabilities: { label: 'Liabilities', color: LIABILITIES_COLOR },
}

// CU-067 — RN-253. Snapshot actual (sin selector de periodo, a diferencia de CU-066); "Assets" aquí
// es Cash & Savings + Investments — ver nota de nomenclatura en dashboard.md.
export function NetworthBalanceDonutCard({ assets, liabilities }: { assets: number; liabilities: number }) {
  const hasData = assets > 0 || liabilities > 0
  const data = [
    { id: 'assets', label: 'Assets', value: assets, fill: ASSETS_COLOR },
    { id: 'liabilities', label: 'Liabilities', value: liabilities, fill: LIABILITIES_COLOR },
  ]

  return (
    <Card className="flex-1">
      <CardHeader className="gap-1">
        <p className="text-base font-semibold text-card-foreground">Networth balance</p>
        <p className="text-sm text-muted-foreground">Assets vs Liabilities</p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <div className="flex items-center gap-10">
            <ChartContainer config={chartConfig} className="aspect-square h-48 shrink-0">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={data} dataKey="value" nameKey="label" innerRadius={64} outerRadius={96} strokeWidth={0}>
                  {data.map((entry) => (
                    <Cell key={entry.id} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="flex flex-1 flex-col gap-3">
              {data.map((entry) => (
                <div key={entry.id} className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                    <span className="text-base font-medium text-card-foreground">{entry.label}</span>
                  </div>
                  <p className="pl-[18px] font-mono text-base text-card-foreground">{formatCurrency(entry.value)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
