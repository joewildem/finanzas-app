import { isAfter } from 'date-fns'

import type { Account } from '@/lib/accounts'
import { computePeriodMonths, PERIOD_LABELS, type Period } from '@/lib/date-periods'
import { computeSaldoActual, DEBT_TYPE_LABELS, type Debt, type DebtType } from '@/lib/debts'
import { computeExposureBreakdown, type Investment } from '@/lib/investments'

export interface NetworthBreakdownItem {
  id: string
  label: string
  monto: number
  color: string
}

export interface NetworthBreakdownGroup {
  total: number
  items: NetworthBreakdownItem[]
}

// RN-242 — Cash & Savings siempre muestra sus 3 categorías estructurales, aunque alguna esté en $0
// (a diferencia de Investments/Liabilities, que son grupos dinámicos por tipo).
const CASH_SAVINGS_COLORS = {
  savings: '#3730a3',
  debit_accounts: '#6366f1',
  cash: '#818cf8',
} as const

export function buildCashAndSavingsBreakdown(
  savingsTotal: number,
  debitTotal: number,
  cashTotal: number,
): NetworthBreakdownGroup {
  const items: NetworthBreakdownItem[] = [
    { id: 'savings', label: 'Savings', monto: savingsTotal, color: CASH_SAVINGS_COLORS.savings },
    { id: 'debit_accounts', label: 'Debit Accounts', monto: debitTotal, color: CASH_SAVINGS_COLORS.debit_accounts },
    { id: 'cash', label: 'Cash', monto: cashTotal, color: CASH_SAVINGS_COLORS.cash },
  ].sort((a, b) => b.monto - a.monto)
  return { total: savingsTotal + debitTotal + cashTotal, items }
}

// RN-243 — agrupado por tipo_activo, solo tipos con al menos un instrumento activo (gratis, ya que
// computeExposureBreakdown solo agrega lo que recibe).
const INVESTMENT_COLOR_PALETTE = ['#581c87', '#7e22ce', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#3b0764']

export function buildInvestmentsBreakdown(activeInvestments: Investment[]): NetworthBreakdownGroup {
  const rows = computeExposureBreakdown(activeInvestments, 'tipo_activo')
  const total = rows.reduce((sum, r) => sum + r.monto, 0)
  const items = rows.map((r, i) => ({
    id: r.key,
    label: r.key,
    monto: r.monto,
    color: INVESTMENT_COLOR_PALETTE[i % INVESTMENT_COLOR_PALETTE.length],
  }))
  return { total, items }
}

// RN-244 — "Credit Cards" siempre aparece (aunque sea $0); un ítem por cada tipo de deuda activa
// con datos.
export function groupDebtBalancesByType(
  activeDebts: Debt[],
  capitalPagosByDebt: Record<string, number[]>,
): { tipo: DebtType; monto: number }[] {
  const totals = new Map<DebtType, number>()
  for (const debt of activeDebts) {
    const saldo = computeSaldoActual(debt, capitalPagosByDebt[debt.id] ?? [])
    totals.set(debt.tipo, (totals.get(debt.tipo) ?? 0) + saldo)
  }
  return [...totals.entries()].map(([tipo, monto]) => ({ tipo, monto }))
}

const LIABILITY_COLOR_PALETTE = ['#9f1239', '#be123c', '#e11d48', '#f43f5e', '#fb7185']

export function buildLiabilitiesBreakdown(
  creditCardsTotal: number,
  debtTotalsByType: { tipo: DebtType; monto: number }[],
): NetworthBreakdownGroup {
  const raw = [
    { id: 'credit_cards', label: 'Credit Cards', monto: creditCardsTotal },
    ...debtTotalsByType.map((d) => ({ id: d.tipo, label: DEBT_TYPE_LABELS[d.tipo], monto: d.monto })),
  ].sort((a, b) => b.monto - a.monto)
  const items = raw.map((item, i) => ({ ...item, color: LIABILITY_COLOR_PALETTE[i % LIABILITY_COLOR_PALETTE.length] }))
  const total = items.reduce((sum, i) => sum + i.monto, 0)
  return { total, items }
}

// RN-253 — "Assets" en este comparativo es exclusivo del componente, no debe confundirse con la
// card "Cash & Savings" (ver nota de nomenclatura de dashboard.md).
export function computeAssetsVsLiabilities(cashAndSavingsTotal: number, investmentsTotal: number, liabilitiesTotal: number) {
  return { assets: cashAndSavingsTotal + investmentsTotal, liabilities: liabilitiesTotal }
}

// RN-255 — sin tope inferior negativo; el gauge se topa en 100 pero el texto refleja el real.
export function computeGoalProgress(networthActual: number, montoObjetivo: number): {
  percentReal: number
  percentCapped: number
} {
  if (montoObjetivo <= 0) return { percentReal: 0, percentCapped: 0 }
  const percentReal = Math.max(0, (networthActual / montoObjetivo) * 100)
  return { percentReal, percentCapped: Math.min(percentReal, 100) }
}

// --- Reconstrucción "a la fecha" (RN-249) ------------------------------------------------------

function sumSignedUpTo(movimientos: { monto: number; fecha: string }[], cutoff: Date): number {
  return movimientos.filter((m) => !isAfter(new Date(m.fecha), cutoff)).reduce((sum, m) => sum + m.monto, 0)
}

export function computeAccountBalanceAsOf(
  account: Pick<Account, 'saldo_inicial' | 'created_at'>,
  movimientos: { monto: number; fecha: string }[],
  cutoff: Date,
): number {
  if (isAfter(new Date(account.created_at), cutoff)) return 0
  return account.saldo_inicial + sumSignedUpTo(movimientos, cutoff)
}

export function computeGoalAmountAsOf(
  goal: { monto_inicial: number; created_at: string },
  movimientos: { monto: number; fecha: string }[],
  cutoff: Date,
): number {
  if (isAfter(new Date(goal.created_at), cutoff)) return 0
  return goal.monto_inicial - sumSignedUpTo(movimientos, cutoff)
}

export function computeDebtBalanceAsOf(
  debt: { monto_original: number; created_at: string },
  pagos: { monto_capital: number; fecha: string }[],
  cutoff: Date,
): number {
  if (isAfter(new Date(debt.created_at), cutoff)) return 0
  const capitalPagado = pagos
    .filter((p) => !isAfter(new Date(p.fecha), cutoff))
    .reduce((sum, p) => sum + p.monto_capital, 0)
  return debt.monto_original - capitalPagado
}

// RN-249 — snapshot más reciente con fecha <= cutoff; si no existe ninguno, el instrumento aún no
// existía en ese punto (0). Comparación lexicográfica válida porque `fecha` es 'YYYY-MM-DD'.
export function computeInvestmentValueAsOf(history: { fecha: string; balance: number }[], cutoffIso: string): number {
  const eligible = history.filter((h) => h.fecha <= cutoffIso)
  if (eligible.length === 0) return 0
  return eligible.reduce((latest, h) => (h.fecha > latest.fecha ? h : latest)).balance
}

// --- Rango de meses navegable (RN-251) ---------------------------------------------------------
//
// Movido a `@/lib/date-periods` (2026-08-28) — Analytics (CU-069/CU-070) usa el mismo vocabulario
// de periodo (1M/6M/YTD/1Y/All/Custom); se generaliza en un solo lugar en vez de duplicar la
// lógica de rangos. Re-exportado aquí con el nombre original para no tocar los call sites
// existentes (`use-networth-history.ts`, `networth-tab.tsx`, `networth-line-chart-card.tsx`).

export type NetworthPeriod = Period
export const NETWORTH_PERIOD_LABELS = PERIOD_LABELS
export const computeNetworthMonths = computePeriodMonths
