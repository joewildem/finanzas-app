import { addMonths, format, parse } from 'date-fns'

export interface Budget {
  id: string
  user_id: string
  category_id: string | null
  meta_id: string | null
  deuda_id: string | null
  mes: string
  monto: number
  created_at: string
  updated_at: string
}

export function currentMonthKey(): string {
  return format(new Date(), 'yyyy-MM')
}

export function shiftMonthKey(mes: string, delta: number): string {
  const date = parse(mes, 'yyyy-MM', new Date())
  return format(addMonths(date, delta), 'yyyy-MM')
}

export function monthKeyLabel(mes: string): string {
  return format(parse(mes, 'yyyy-MM', new Date()), 'MMMM yyyy')
}

export function monthRange(mes: string): { from: string; toExclusive: string } {
  return { from: `${mes}-01`, toExclusive: `${shiftMonthKey(mes, 1)}-01` }
}
