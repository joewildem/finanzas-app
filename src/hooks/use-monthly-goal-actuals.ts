import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import { monthRange } from '@/lib/budgets'

// RN-151 (revisada 2026-10-04, ver RN-358) — "real" mensual de una meta en Presupuesto: suma con
// signo invertido de sus **aportaciones** del mes. Los retiros **no** participan.
//
// Antes se incluía `retiro_meta` y un retiro restaba del "real". El renglón de una meta en
// Presupuesto responde "cuánto de lo que planeé aportar llevo aportado", y un retiro no es una
// aportación negativa: es dinero que sale del ahorro por una razón ajena al plan del mes —una
// emergencia, típicamente— y restarlo hacía que el renglón reportara un avance negativo contra un
// plan que sí se había cumplido. El efecto del retiro sobre el ahorro ya se ve donde corresponde:
// en el saldo de la meta y en la card Savings de Analytics (RN-259), que sí mide el neto.
//
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
      .select('meta_id, monto')
      .gte('fecha', from)
      .lt('fecha', toExclusive)
      .eq('tipo', 'aportacion_meta')

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
