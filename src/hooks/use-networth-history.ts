import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, parse } from 'date-fns'

import {
  computeAccountBalanceAsOf,
  computeDebtBalanceAsOf,
  computeGoalAmountAsOf,
  computeInvestmentValueAsOf,
  computeNetworthMonths,
  type NetworthPeriod,
} from '@/lib/networth'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/lib/accounts'
import type { SavingsGoal } from '@/lib/savings-goals'
import type { Debt } from '@/lib/debts'
import type { Investment } from '@/lib/investments'

export interface NetworthHistoryPoint {
  mes: string
  networthTotal: number
}

function groupBy<T, K extends string | null>(rows: T[], keyOf: (row: T) => K): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const row of rows) {
    const key = keyOf(row)
    if (key === null) continue
    ;(result[key] ??= []).push(row)
  }
  return result
}

// CU-066 — RN-248 a RN-252. Trae todas las fuentes completas (sin filtro de fecha, se necesita el
// historial completo para reconstruir cualquier punto) y reconstruye, mes a mes, Cash & Savings +
// Investments - Liabilities "a la fecha" (RN-249), con granularidad siempre mensual (RN-250).
export function useNetworthHistory(periodo: NetworthPeriod, customRange?: { fechaInicio: Date; fechaFin: Date }) {
  const [meses, setMeses] = useState<NetworthHistoryPoint[] | undefined>(undefined)
  const [earliestDate, setEarliestDate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fechaInicioKey = customRange?.fechaInicio.getTime()
  const fechaFinKey = customRange?.fechaFin.getTime()

  const refetch = useCallback(async () => {
    const [accountsRes, goalsRes, debtsRes, investmentsRes, historyRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('status', 'active'),
      supabase.from('savings_goals').select('*').eq('status', 'active'),
      supabase.from('debts').select('*').eq('status', 'active'),
      supabase.from('investments').select('*').eq('status', 'activo'),
      supabase.from('investment_balance_history').select('investment_id, fecha, balance'),
    ])
    const firstError =
      accountsRes.error ?? goalsRes.error ?? debtsRes.error ?? investmentsRes.error ?? historyRes.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const accounts = accountsRes.data as Account[]
    const goals = goalsRes.data as SavingsGoal[]
    const debts = debtsRes.data as Debt[]
    const investments = investmentsRes.data as Investment[]
    const history = historyRes.data as { investment_id: string; fecha: string; balance: number }[]

    const accountIds = accounts.map((a) => a.id)
    const [accountTxRes, goalTxRes, debtTxRes] = await Promise.all([
      accountIds.length
        ? supabase.from('transactions').select('account_id, monto, fecha').in('account_id', accountIds)
        : Promise.resolve({ data: [] as { account_id: string; monto: number; fecha: string }[], error: null }),
      supabase
        .from('transactions')
        .select('meta_id, monto, fecha')
        .in('tipo', ['aportacion_meta', 'retiro_meta']),
      supabase.from('transactions').select('deuda_id, monto_capital, fecha').eq('tipo', 'pago_deuda'),
    ])
    const secondError = accountTxRes.error ?? goalTxRes.error ?? debtTxRes.error
    if (secondError) {
      setError(secondError.message)
      return
    }
    setError(null)

    const txByAccount = groupBy(
      accountTxRes.data as { account_id: string | null; monto: number; fecha: string }[],
      (r) => r.account_id,
    )
    const movementsByGoal = groupBy(
      goalTxRes.data as { meta_id: string | null; monto: number; fecha: string }[],
      (r) => r.meta_id,
    )
    const pagosByDebt = groupBy(
      debtTxRes.data as { deuda_id: string | null; monto_capital: number; fecha: string }[],
      (r) => r.deuda_id,
    )
    const historyByInvestment = groupBy(history, (r) => r.investment_id)

    const creationDates = [
      ...accounts.map((a) => a.created_at),
      ...goals.map((g) => g.created_at),
      ...debts.map((d) => d.created_at),
      ...investments.map((i) => i.created_at),
    ]
    const earliest = creationDates.length
      ? new Date(Math.min(...creationDates.map((d) => new Date(d).getTime())))
      : null
    setEarliestDate(earliest)

    const months = computeNetworthMonths(periodo, {
      earliestDate: earliest,
      fechaInicio: fechaInicioKey !== undefined ? new Date(fechaInicioKey) : undefined,
      fechaFin: fechaFinKey !== undefined ? new Date(fechaFinKey) : undefined,
    })

    const points: NetworthHistoryPoint[] = months.map((mes) => {
      const cutoff = endOfMonth(parse(mes, 'yyyy-MM', new Date()))
      const cutoffIso = mes + '-31' // comparación lexicográfica, cualquier día del mes siguiente basta

      const cashAndSavings =
        goals.reduce((sum, g) => sum + computeGoalAmountAsOf(g, movementsByGoal[g.id] ?? [], cutoff), 0) +
        accounts
          .filter((a) => a.tipo === 'debito' && !a.excluir_de_stats)
          .reduce((sum, a) => sum + computeAccountBalanceAsOf(a, txByAccount[a.id] ?? [], cutoff), 0) +
        accounts
          .filter((a) => a.tipo === 'efectivo' && !a.excluir_de_stats)
          .reduce((sum, a) => sum + computeAccountBalanceAsOf(a, txByAccount[a.id] ?? [], cutoff), 0)

      const investmentsTotal = investments.reduce(
        (sum, inv) => sum + computeInvestmentValueAsOf(historyByInvestment[inv.id] ?? [], cutoffIso),
        0,
      )

      const creditCardsTotal = accounts
        .filter((a) => a.tipo === 'credito')
        .reduce((sum, a) => sum + Math.abs(computeAccountBalanceAsOf(a, txByAccount[a.id] ?? [], cutoff)), 0)
      const debtsTotal = debts.reduce((sum, d) => sum + computeDebtBalanceAsOf(d, pagosByDebt[d.id] ?? [], cutoff), 0)

      return { mes, networthTotal: cashAndSavings + investmentsTotal - (creditCardsTotal + debtsTotal) }
    })

    setMeses(points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, fechaInicioKey, fechaFinKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { meses, earliestDate, error, refetch }
}
