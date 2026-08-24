import { addDays, endOfMonth, endOfWeek, endOfYear, format, parse, startOfMonth, startOfWeek, startOfYear } from 'date-fns'

import { monthRange, shiftMonthKey } from '@/lib/budgets'

// RN-088 — mecanismo de resolución de rango de fechas compartido por CU-027 a CU-031. `semana`
// usa lunes como inicio de semana (no especificado en el PRD — decisión de implementación).
export type ReportPeriodType = 'semana' | 'mes' | 'anio' | 'personalizado'

export type ReportPeriodInput =
  | { periodo: 'semana' | 'mes' | 'anio'; fechaReferencia?: string }
  | { periodo: 'personalizado'; desde: string; hasta: string }

export interface DateRange {
  from: string
  toExclusive: string
}

// `parse(..., new Date())` en vez de `new Date(string)` — evita el corrimiento de un día que
// produce interpretar un string `yyyy-MM-dd` como medianoche UTC y luego formatearlo en hora local
// (mismo cuidado que ya toma `budgets.ts` con `shiftMonthKey`/`monthRange`).
function parseDateOnly(value: string): Date {
  return parse(value, 'yyyy-MM-dd', new Date())
}

function toDateOnly(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function resolvePeriodRange(input: ReportPeriodInput): DateRange {
  if (input.periodo === 'personalizado') {
    return { from: input.desde, toExclusive: toDateOnly(addDays(parseDateOnly(input.hasta), 1)) }
  }

  const ref = input.fechaReferencia ? parseDateOnly(input.fechaReferencia) : new Date()

  switch (input.periodo) {
    case 'semana':
      return {
        from: toDateOnly(startOfWeek(ref, { weekStartsOn: 1 })),
        toExclusive: toDateOnly(addDays(endOfWeek(ref, { weekStartsOn: 1 }), 1)),
      }
    case 'mes':
      return {
        from: toDateOnly(startOfMonth(ref)),
        toExclusive: toDateOnly(addDays(endOfMonth(ref), 1)),
      }
    case 'anio':
      return {
        from: toDateOnly(startOfYear(ref)),
        toExclusive: toDateOnly(addDays(endOfYear(ref), 1)),
      }
  }
}

// RN-087 (alt. flow) — cuando el periodo cubre más de un mes calendario, Ahorros suma el
// presupuestado de cada mes tocado por el rango. Devuelve las llaves `yyyy-MM` en orden.
export function monthKeysInRange(range: DateRange): string[] {
  const lastIncludedDay = addDays(parseDateOnly(range.toExclusive), -1)
  const lastKey = format(lastIncludedDay, 'yyyy-MM')

  const keys: string[] = []
  let cursor = format(parseDateOnly(range.from), 'yyyy-MM')
  while (true) {
    keys.push(cursor)
    if (cursor === lastKey) break
    cursor = shiftMonthKey(cursor, 1)
  }
  return keys
}

// RN-097 — CU-031 compara siempre contra el mes calendario inmediato anterior, sin importar el
// periodo elegido en el resto del Reporte Mensual.
export function previousCalendarMonthRange(referenceDate: Date = new Date()): DateRange {
  const previousMonthKey = shiftMonthKey(format(referenceDate, 'yyyy-MM'), -1)
  return monthRange(previousMonthKey)
}
