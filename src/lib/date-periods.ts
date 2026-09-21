import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'

// Vocabulario de periodo compartido entre Networth (CU-066) y Analytics (CU-069/CU-070) — un
// segmentador 1M/6M/YTD/1Y/All/Custom, reutilizado tal cual en ambas pestañas del Dashboard.
export type Period = '1m' | '6m' | 'ytd' | '1y' | 'all' | 'custom'

export const PERIOD_LABELS: Record<Period, string> = {
  '1m': '1M',
  '6m': '6M',
  ytd: 'YTD',
  '1y': '1Y',
  all: 'All',
  custom: 'Custom',
}

export interface PeriodOpts {
  earliestDate?: Date | null
  fechaInicio?: Date
  fechaFin?: Date
  today?: Date
}

function lastNMonths(n: number, referenceDate: Date): string[] {
  return Array.from({ length: n }, (_, i) => format(subMonths(referenceDate, n - 1 - i), 'yyyy-MM'))
}

function monthsBetween(start: Date, end: Date): string[] {
  const months: string[] = []
  let cursor = startOfMonth(start)
  const last = startOfMonth(end)
  while (!isAfter(cursor, last)) {
    months.push(format(cursor, 'yyyy-MM'))
    cursor = addMonths(cursor, 1)
  }
  return months
}

// RN-251 (Networth, CU-066) / RN-265 (Analytics, CU-070) — lista de meses a graficar, siempre con
// granularidad mensual sin importar el periodo seleccionado.
export function computePeriodMonths(periodo: Period, opts: PeriodOpts = {}): string[] {
  const today = opts.today ?? new Date()
  switch (periodo) {
    case '1m':
      return lastNMonths(2, today)
    case '6m':
      return lastNMonths(6, today)
    case '1y':
      return lastNMonths(12, today)
    case 'ytd':
      return monthsBetween(startOfYear(today), today)
    case 'all':
      return opts.earliestDate ? monthsBetween(opts.earliestDate, today) : []
    case 'custom':
      return opts.fechaInicio && opts.fechaFin ? monthsBetween(opts.fechaInicio, opts.fechaFin) : []
  }
}

export interface DateRange {
  from: Date
  to: Date
}

// RN-261 (Analytics, CU-069) — rango exacto del periodo actual, para sumar totales (no bucketizado
// por mes, a diferencia de computePeriodMonths).
export function computeCurrentPeriodRange(periodo: Period, opts: PeriodOpts = {}): DateRange | null {
  const today = opts.today ?? new Date()
  switch (periodo) {
    case '1m':
      return { from: startOfMonth(today), to: today }
    case '6m':
      return { from: startOfMonth(subMonths(today, 5)), to: today }
    case 'ytd':
      return { from: startOfYear(today), to: today }
    case '1y':
      return { from: startOfMonth(subMonths(today, 11)), to: today }
    case 'all':
      return opts.earliestDate ? { from: opts.earliestDate, to: today } : null
    case 'custom':
      return opts.fechaInicio && opts.fechaFin ? { from: opts.fechaInicio, to: opts.fechaFin } : null
  }
}

// RN-261 (Analytics, CU-069) — rango de comparación: mismo tamaño, inmediatamente anterior al
// rango actual. `null` para "all" (RN-263, sin comparación posible) o si el rango actual no aplica.
export function computePreviousPeriodRange(periodo: Period, opts: PeriodOpts = {}): DateRange | null {
  const today = opts.today ?? new Date()
  switch (periodo) {
    case '1m': {
      const ref = subMonths(today, 1)
      return { from: startOfMonth(ref), to: endOfMonth(ref) }
    }
    case '6m': {
      const currentFrom = startOfMonth(subMonths(today, 5))
      return { from: startOfMonth(subMonths(currentFrom, 6)), to: subDays(currentFrom, 1) }
    }
    case 'ytd': {
      const ref = subYears(today, 1)
      return { from: startOfYear(ref), to: ref }
    }
    case '1y': {
      const currentFrom = startOfMonth(subMonths(today, 11))
      return { from: startOfMonth(subMonths(currentFrom, 12)), to: subDays(currentFrom, 1) }
    }
    case 'all':
      return null
    case 'custom': {
      if (!opts.fechaInicio || !opts.fechaFin) return null
      const dias = differenceInCalendarDays(opts.fechaFin, opts.fechaInicio) + 1
      return { from: subDays(opts.fechaInicio, dias), to: subDays(opts.fechaInicio, 1) }
    }
  }
}

// `to` opcional además de `undefined`: así encaja con el `DateRange` de react-day-picker sin que
// el componente tenga que traducir entre ambos.
export interface PickedRange {
  from: Date | undefined
  to?: Date | undefined
}

// Arma un rango a partir de los clics del usuario en un calendario, en dos fases explícitas: el
// primer clic fija el inicio y el segundo lo cierra, ordenándolo por si eligió una fecha anterior al
// inicio. Dos clics en el mismo día son un rango de un solo día. Un clic con el rango ya completo
// empieza uno nuevo.
//
// Existe porque el `addToRange` de react-day-picker devuelve `{ from: día, to: día }` desde el
// PRIMER clic (su `min` es 0 por defecto): el rango nacía "completo", así que el calendario se
// cerraba antes de poder elegir el fin y el siguiente clic reemplazaba el inicio o el fin según
// fuera anterior o posterior a lo ya elegido. La misma fecha quedaba unas veces como inicio y otras
// como fin, sin que el usuario pudiera predecirlo.
export function nextPickedRange(current: PickedRange, day: Date): PickedRange {
  const empiezaRangoNuevo = !current.from || current.to !== undefined
  if (empiezaRangoNuevo) return { from: day, to: undefined }
  return isBefore(day, current.from!) ? { from: day, to: current.from } : { from: current.from, to: day }
}
