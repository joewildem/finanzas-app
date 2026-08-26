import { useState } from 'react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { PERIOD_LABELS, type Period } from '@/lib/date-periods'

const PERIODS: Period[] = ['1m', '6m', 'ytd', '1y', 'all', 'custom']

// CU-069/CU-070/CU-071 — un solo segmentador de periodo compartido por toda la pestaña Analytics
// (a diferencia de Networth, donde el periodo solo gobernaba la gráfica de historial).
export function AnalyticsPeriodSelector({
  periodo,
  onChangePeriodo,
  customRange,
  onChangeCustomRange,
}: {
  periodo: Period
  onChangePeriodo: (periodo: Period) => void
  customRange: { fechaInicio: Date; fechaFin: Date }
  onChangeCustomRange: (range: { fechaInicio: Date; fechaFin: Date }) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={p === periodo ? 'secondary' : 'outline'}
            onClick={() => onChangePeriodo(p)}
          >
            {PERIOD_LABELS[p]}
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
    </div>
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
