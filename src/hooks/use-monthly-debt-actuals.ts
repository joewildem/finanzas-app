import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { monthRange } from '@/lib/budgets'

// RN-223 — "real" mensual de una deuda: suma de monto_capital + monto_interes de sus pagos
// (pago_deuda) del mes — a diferencia del saldo de la deuda (que solo cuenta capital), aquí se
// cuenta la salida de efectivo completa. Ambos valores ya se guardan en positivo (RN-215), sin
// necesidad de invertir signo como en `useMonthlyGoalActuals`. Calculado al vuelo, nunca persistido.
export function useMonthlyDebtActuals(mes: string) {
  const [state, setState] = useState<{ mes: string; actuals: Record<string, number> | undefined }>(() => ({
    mes,
    actuals: undefined,
  }))
  const [error, setError] = useState<string | null>(null)

  if (state.mes !== mes) {
    setState({ mes, actuals: undefined })
  }

  const refetch = useCallback(async () => {
    const { from, toExclusive } = monthRange(mes)
    const { data, error } = await supabase
      .from('transactions')
      .select('deuda_id, monto_capital, monto_interes')
      .gte('fecha', from)
      .lt('fecha', toExclusive)
      .eq('tipo', 'pago_deuda')

    if (error) {
      setError(error.message)
      return
    }
    setError(null)

    const totals: Record<string, number> = {}
    for (const row of data as { deuda_id: string | null; monto_capital: number; monto_interes: number }[]) {
      if (!row.deuda_id) continue
      totals[row.deuda_id] = (totals[row.deuda_id] ?? 0) + row.monto_capital + row.monto_interes
    }
    setState({ mes, actuals: totals })
  }, [mes])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { actuals: state.actuals, error, refetch }
}
