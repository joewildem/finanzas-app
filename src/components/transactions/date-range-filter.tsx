import { useState } from 'react'
import { format, startOfMonth, subDays } from 'date-fns'
import type { DateRange } from 'react-day-picker'

import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type DateRangePreset =
  | 'all'
  | 'this_month'
  | 'last_week'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months'
  | 'custom'

export interface DateRangeValue {
  fechaDesde?: string
  fechaHasta?: string
}

const PRESET_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_week', label: 'Last week' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom range' },
]

const PRESET_LABELS = Object.fromEntries(PRESET_OPTIONS.map((option) => [option.value, option.label])) as Record<
  DateRangePreset,
  string
>

function computeRange(preset: DateRangePreset, custom: DateRange): DateRangeValue {
  const today = new Date()
  const fechaHasta = format(today, 'yyyy-MM-dd')

  switch (preset) {
    case 'this_month':
      return { fechaDesde: format(startOfMonth(today), 'yyyy-MM-dd'), fechaHasta }
    case 'last_week':
      return { fechaDesde: format(subDays(today, 7), 'yyyy-MM-dd'), fechaHasta }
    case 'last_3_months':
      return { fechaDesde: format(subDays(today, 90), 'yyyy-MM-dd'), fechaHasta }
    case 'last_6_months':
      return { fechaDesde: format(subDays(today, 180), 'yyyy-MM-dd'), fechaHasta }
    case 'last_12_months':
      return { fechaDesde: format(subDays(today, 365), 'yyyy-MM-dd'), fechaHasta }
    case 'custom':
      return {
        fechaDesde: custom.from ? format(custom.from, 'yyyy-MM-dd') : undefined,
        fechaHasta: custom.to ? format(custom.to, 'yyyy-MM-dd') : undefined,
      }
    default:
      return {}
  }
}

// CU-016 (`rango_fecha`) — presets calculados en el cliente; `fecha_desde`/`fecha_hasta` ya
// existían en el GET de listado, no requiere cambios de backend. "Custom range" despliega el
// Calendar de shadcn/ui en modo rango en un Popover aparte (no anidado en el Select, que ya
// controla su propio popup) — el componente es dueño de su estado de preset/rango; hacia afuera
// solo expone el resultado ya traducido a fecha_desde/fecha_hasta.
export function DateRangeFilter({ onChange }: { onChange: (value: DateRangeValue) => void }) {
  const [preset, setPreset] = useState<DateRangePreset>('all')
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [calendarOpen, setCalendarOpen] = useState(false)

  function selectPreset(next: DateRangePreset) {
    setPreset(next)
    onChange(computeRange(next, customRange))
    if (next === 'custom') setCalendarOpen(true)
  }

  const customLabel =
    customRange.from && customRange.to
      ? `${format(customRange.from, 'd MMM')} – ${format(customRange.to, 'd MMM yyyy')}`
      : customRange.from
        ? `${format(customRange.from, 'd MMM yyyy')} – …`
        : 'Pick dates'

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Date range</label>
        <Select value={preset} onValueChange={(value) => value && selectPreset(value as DateRangePreset)}>
          <SelectTrigger className="w-40">
            <SelectValue>{(value: DateRangePreset) => PRESET_LABELS[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {PRESET_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {preset === 'custom' && (
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            }
          >
            {customLabel}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-fit p-0">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={customRange}
              onSelect={(range) => {
                const next = { from: range?.from, to: range?.to }
                setCustomRange(next)
                onChange(computeRange('custom', next))
                if (next.from && next.to) setCalendarOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
