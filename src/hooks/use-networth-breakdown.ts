import { useCallback, useEffect, useState } from 'react'

import {
  buildCashAndSavingsBreakdown,
  buildInvestmentsBreakdown,
  buildLiabilitiesBreakdown,
  groupDebtBalancesByType,
  type NetworthBreakdownGroup,
} from '@/lib/networth'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/lib/accounts'
import { computeMontoAportadoActual, type SavingsGoal } from '@/lib/savings-goals'
import type { Investment } from '@/lib/investments'
import type { Debt } from '@/lib/debts'

export interface NetworthBreakdown {
  cashAndSavings: NetworthBreakdownGroup
  investments: NetworthBreakdownGroup
  liabilities: NetworthBreakdownGroup
}

// CU-065 — RN-242 a RN-247. Una sola pasada de consultas (cuentas activas, metas activas + sus
// movimientos, todas las inversiones (activas e inactivas — el estado solo aplica al cálculo de
// next share dentro de Inversiones, RN-148/149 de [[inversiones]], no a los totales agregados),
// deudas activas + sus pagos) para construir los tres totales; mismo criterio de "una sola consulta
// trae todo, se agrupa en cliente" ya usado en SavingsListPage/DebtsListPage.
export function useNetworthBreakdown() {
  const [breakdown, setBreakdown] = useState<NetworthBreakdown | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const [accountsRes, goalsRes, investmentsRes, debtsRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('status', 'active'),
      supabase.from('savings_goals').select('*').eq('status', 'active'),
      supabase.from('investments').select('*'),
      supabase.from('debts').select('*').eq('status', 'active'),
    ])

    const firstError = accountsRes.error ?? goalsRes.error ?? investmentsRes.error ?? debtsRes.error
    if (firstError) {
      setError(firstError.message)
      return
    }

    const accounts = accountsRes.data as Account[]
    const goals = goalsRes.data as SavingsGoal[]
    const investments = investmentsRes.data as Investment[]
    const debts = debtsRes.data as Debt[]

    const [goalMovementsRes, debtPaymentsRes] = await Promise.all([
      supabase.from('transactions').select('meta_id, monto').in('tipo', ['aportacion_meta', 'retiro_meta']),
      supabase.from('transactions').select('deuda_id, monto_capital').eq('tipo', 'pago_deuda'),
    ])
    if (goalMovementsRes.error || debtPaymentsRes.error) {
      setError((goalMovementsRes.error ?? debtPaymentsRes.error)!.message)
      return
    }
    setError(null)

    const movementsByGoal: Record<string, { monto: number }[]> = {}
    for (const row of goalMovementsRes.data as { meta_id: string | null; monto: number }[]) {
      if (!row.meta_id) continue
      ;(movementsByGoal[row.meta_id] ??= []).push({ monto: row.monto })
    }

    const capitalByDebt: Record<string, number[]> = {}
    for (const row of debtPaymentsRes.data as { deuda_id: string | null; monto_capital: number }[]) {
      if (!row.deuda_id) continue
      ;(capitalByDebt[row.deuda_id] ??= []).push(row.monto_capital)
    }

    // RN-242
    const savingsTotal = goals.reduce(
      (sum, goal) => sum + computeMontoAportadoActual(goal, movementsByGoal[goal.id] ?? []),
      0,
    )
    const debitTotal = accounts
      .filter((a) => a.tipo === 'debito' && !a.excluir_de_stats)
      .reduce((sum, a) => sum + a.saldo_actual, 0)
    const cashTotal = accounts
      .filter((a) => a.tipo === 'efectivo' && !a.excluir_de_stats)
      .reduce((sum, a) => sum + a.saldo_actual, 0)

    // RN-244
    const creditCardsTotal = accounts
      .filter((a) => a.tipo === 'credito')
      .reduce((sum, a) => sum + Math.abs(a.saldo_actual), 0)
    const debtTotalsByType = groupDebtBalancesByType(debts, capitalByDebt)

    setBreakdown({
      cashAndSavings: buildCashAndSavingsBreakdown(savingsTotal, debitTotal, cashTotal),
      investments: buildInvestmentsBreakdown(investments),
      liabilities: buildLiabilitiesBreakdown(creditCardsTotal, debtTotalsByType),
    })
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { breakdown, error, refetch }
}
