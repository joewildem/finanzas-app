import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { monthRange } from '@/lib/budgets'

// RN-151 — "real" mensual de una meta: suma **con signo invertido** de sus transacciones
// (aportacion_meta, retiro_meta) del mes — a diferencia de `useMonthlyActuals` (que usa
// Math.abs, ya que ahí solo existen gastos negativos e ingresos positivos), aquí un retiro debe
// restar del "real" del mes, no sumar, así que se conserva el signo invertido en vez de abs().
// Calculado al vuelo, nunca persistido — mismo patrón que `useMonthlyActuals`.
export function useMonthlyGoalActuals(mes: string) {
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
      .select('meta_id, monto, tipo')
      .gte('fecha', from)
      .lt('fecha', toExclusive)
      .in('tipo', ['aportacion_meta', 'retiro_meta'])

    if (error) {
      setError(error.message)
      return
    }
    setError(null)

    const totals: Record<string, number> = {}
    for (const row of data as { meta_id: string | null; monto: number }[]) {
      if (!row.meta_id) continue
      totals[row.meta_id] = (totals[row.meta_id] ?? 0) - row.monto
    }
    setState({ mes, actuals: totals })
  }, [mes])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { actuals: state.actuals, error, refetch }
}
