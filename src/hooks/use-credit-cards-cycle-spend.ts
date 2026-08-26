import { useCallback, useEffect, useState } from 'react'
import { subMonths } from 'date-fns'

import type { Account } from '@/lib/accounts'
import { computeCurrentStatementCycle } from '@/lib/dashboard'
import { supabase } from '@/lib/supabase'

export interface CycleSpend {
  ciclo_desde: string
  ciclo_hasta: string
  gasto_ciclo_actual: number
}

// CU-063 — RN-236/RN-237: gasto del ciclo de corte en curso, por tarjeta (cada una puede tener un
// `dia_corte` distinto). Se trae una ventana de 2 meses de gasto y se agrupa en cliente por el
// ciclo propio de cada cuenta, en vez de una consulta por tarjeta. Tarjetas sin `dia_corte`
// configurado (no debería pasar en la práctica, es requerido para `tipo=credito`) quedan fuera del
// resultado — sin ciclo que calcular, no se muestra el indicador para esa tarjeta.
export function useCreditCardsCycleSpend(creditAccounts: Account[]) {
  const [spendByAccount, setSpendByAccount] = useState<Record<string, CycleSpend> | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const accountIdsKey = creditAccounts.map((a) => a.id).join(',')

  const refetch = useCallback(async () => {
    if (creditAccounts.length === 0) {
      setSpendByAccount({})
      setError(null)
      return
    }

    const windowStart = subMonths(new Date(), 2)
    const { data, error: txError } = await supabase
      .from('transactions')
      .select('account_id, monto, fecha')
      .eq('tipo', 'gasto')
      .in(
        'account_id',
        creditAccounts.map((a) => a.id),
      )
      .gte('fecha', windowStart.toISOString())

    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const txs = data as { account_id: string; monto: number; fecha: string }[]
    const result: Record<string, CycleSpend> = {}

    for (const account of creditAccounts) {
      if (account.dia_corte == null) continue
      const cycle = computeCurrentStatementCycle(account.dia_corte)
      const gasto = txs
        .filter(
          (t) =>
            t.account_id === account.id &&
            new Date(t.fecha) >= cycle.from &&
            new Date(t.fecha) < cycle.toExclusive,
        )
        .reduce((sum, t) => sum + Math.abs(t.monto), 0)

      result[account.id] = {
        ciclo_desde: cycle.from.toISOString().slice(0, 10),
        ciclo_hasta: cycle.toExclusive.toISOString().slice(0, 10),
        gasto_ciclo_actual: gasto,
      }
    }

    setSpendByAccount(result)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { spendByAccount, error, refetch }
}
