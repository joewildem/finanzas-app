import { useState } from 'react'
import { format, parse } from 'date-fns'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { NetworthHistoryPoint } from '@/hooks/use-networth-history'
import { formatCurrency } from '@/lib/accounts'
import { NETWORTH_PERIOD_LABELS, type NetworthPeriod } from '@/lib/networth'

const PERIODS: NetworthPeriod[] = ['1m', '6m', 'ytd', '1y', 'all', 'custom']

const chartConfig: ChartConfig = { networthTotal: { label: 'Networth', color: '#22c55e' } }

// CU-066 — RN-248 a RN-252. Área con degradado (chart-area de shadcn/ui), granularidad siempre
// mensual (RN-250); el segmentador de periodo solo cambia cuántos meses trae `data`, nunca la
// resolución de cada punto.
export function NetworthLineChartCard({
  data,
  periodo,
  onChangePeriodo,
  customRange,
  onChangeCustomRange,
}: {
  data: NetworthHistoryPoint[]
  periodo: NetworthPeriod
  onChangePeriodo: (periodo: NetworthPeriod) => void
  customRange: { fechaInicio: Date; fechaFin: Date }
  onChangeCustomRange: (range: { fechaInicio: Date; fechaFin: Date }) => void
}) {
  const total = data.length > 0 ? data[data.length - 1].networthTotal : 0
  const chartData = data.map((point) => ({
    ...point,
    mesLabel: format(parse(point.mes, 'yyyy-MM', new Date()), 'MMM'),
  }))

  return (
    <Card>
      <CardHeader className="gap-2">
        <p className="text-base font-semibold text-card-foreground">Total Networth</p>
        <p className="font-mono text-2xl font-regular text-card-foreground">{formatCurrency(total)}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODS.map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={p === periodo ? 'secondary' : 'outline'}
              onClick={() => onChangePeriodo(p)}
            >
              {NETWORTH_PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        {periodo === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <CustomDatePicker
              label="From"
              value={customRange.fechaInicio}
              onChange={(fecha) => onChangeCustomRange({ ...customRange, fechaInicio: fecha })}
            />
            <CustomDatePicker
              label="To"
              value={customRange.fechaFin}
              onChange={(fecha) => onChangeCustomRange({ ...customRange, fechaFin: fecha })}
            />
          </div>
        )}

        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="networthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-networthTotal)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="var(--color-networthTotal)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="networthTotal"
                type="monotone"
                stroke="var(--color-networthTotal)"
                fill="url(#networthFill)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function CustomDatePicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: Date
  onChange: (date: Date) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/50"
          />
        }
      >
        <span className="text-muted-foreground">{label}</span>
        <span>{format(value, 'd MMM yyyy')}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-fit p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            if (date) {
              onChange(date)
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
