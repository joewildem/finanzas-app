import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { monthRange } from '@/lib/budgets'

// CU-022 — "real" por categoría: suma de los movimientos de tipo gasto/ingreso del mes, en valor
// absoluto (RN-038: gasto se guarda negativo, ingreso positivo con signo — abs los hace comparables
// al `monto` presupuestado, que siempre se captura positivo, RN-057). Calculado al vuelo, nunca
// persistido — mismo criterio que `accounts.disponible`.
export function useMonthlyActuals(mes: string) {
  const [state, setState] = useState<{ mes: string; actuals: Record<string, number> | undefined }>(() => ({
    mes,
    actuals: undefined,
  }))
  const [error, setError] = useState<string | null>(null)

  // Mismo ajuste "durante el render" que `useBudgets` — evita que `mes` y `actuals` queden
  // desincronizados por un render, ya que ambos alimentan la misma vista con transiciones de mes.
  if (state.mes !== mes) {
    setState({ mes, actuals: undefined })
  }

  const refetch = useCallback(async () => {
    const { from, toExclusive } = monthRange(mes)
    const { data, error } = await supabase
      .from('transactions')
      .select('category_id, monto, tipo')
      .gte('fecha', from)
      .lt('fecha', toExclusive)
      .in('tipo', ['gasto', 'ingreso'])

    if (error) {
      setError(error.message)
      return
    }
    setError(null)

    const totals: Record<string, number> = {}
    for (const row of data as { category_id: string | null; monto: number }[]) {
      if (!row.category_id) continue
      totals[row.category_id] = (totals[row.category_id] ?? 0) + Math.abs(row.monto)
    }
    setState({ mes, actuals: totals })
  }, [mes])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { actuals: state.actuals, error, refetch }
}
