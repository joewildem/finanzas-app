import { useCallback, useEffect, useState } from 'react'

import { currentMonthKey, monthRange } from '@/lib/budgets'
import { supabase } from '@/lib/supabase'

// CU-025 — RN-083: gasto del mes en curso por tarjeta, suma en valor absoluto de `transactions`
// `tipo=gasto` de esa cuenta dentro del mes calendario en curso.
export function useCreditCardsMonthlySpend(accountIds: string[]) {
  const [spendByAccount, setSpendByAccount] = useState<Record<string, number> | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const accountIdsKey = accountIds.join(',')

  const refetch = useCallback(async () => {
    if (accountIds.length === 0) {
      setSpendByAccount({})
      setError(null)
      return
    }

    const range = monthRange(currentMonthKey())
    const { data, error: txError } = await supabase
      .from('transactions')
      .select('account_id, monto')
      .eq('tipo', 'gasto')
      .in('account_id', accountIds)
      .gte('fecha', range.from)
      .lt('fecha', range.toExclusive)

    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const result: Record<string, number> = {}
    for (const tx of data as { account_id: string; monto: number }[]) {
      result[tx.account_id] = (result[tx.account_id] ?? 0) + Math.abs(tx.monto)
    }
    setSpendByAccount(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { spendByAccount, error, refetch }
}
