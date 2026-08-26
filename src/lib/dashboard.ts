import { addMonths, getDaysInMonth, setDate, startOfMonth } from 'date-fns'

import type { Account } from '@/lib/accounts'

// RN-227/RN-235 (Balance) — no excluidas primero, de mayor a menor saldo_actual; luego excluidas
// en el mismo criterio. Para tarjetas de crédito (sin concepto de exclusión) se usa directamente
// `sortByBalanceDesc`.
export function sortByBalanceDesc(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => b.saldo_actual - a.saldo_actual)
}

export function sortDebitCashAccounts(accounts: Account[]): Account[] {
  const notExcluded = sortByBalanceDesc(accounts.filter((a) => !a.excluir_de_stats))
  const excluded = sortByBalanceDesc(accounts.filter((a) => a.excluir_de_stats))
  return [...notExcluded, ...excluded]
}

// RN-232/RN-240 — año navegable acotado a [año de creación de la cuenta activa más antigua del
// tipo relevante, año en curso]. `null` si no hay cuentas de ese tipo (sin rango que ofrecer).
export function computeNavigableYearRange(accounts: Account[]): { min: number; max: number } | null {
  if (accounts.length === 0) return null
  const currentYear = new Date().getFullYear()
  const oldestYear = Math.min(...accounts.map((a) => new Date(a.created_at).getFullYear()))
  return { min: Math.min(oldestYear, currentYear), max: currentYear }
}

// RN-236 — recorta `diaCorte` al último día del mes de referencia si ese día no existe en él
// (ej. 31 en febrero).
function cutoffInMonth(monthReference: Date, diaCorte: number): Date {
  const daysInMonth = getDaysInMonth(monthReference)
  return setDate(startOfMonth(monthReference), Math.min(diaCorte, daysInMonth))
}

export interface StatementCycle {
  from: Date
  toExclusive: Date
}

// RN-236 — ciclo de corte en curso a partir de `dia_corte`: si hoy >= día de corte de este mes, el
// ciclo va de ese día a el mismo día del próximo mes; si no, del mes anterior a este mes.
export function computeCurrentStatementCycle(diaCorte: number, today: Date = new Date()): StatementCycle {
  const thisMonthCutoff = cutoffInMonth(today, diaCorte)
  if (today >= thisMonthCutoff) {
    return { from: thisMonthCutoff, toExclusive: cutoffInMonth(addMonths(today, 1), diaCorte) }
  }
  return { from: cutoffInMonth(addMonths(today, -1), diaCorte), toExclusive: thisMonthCutoff }
}
