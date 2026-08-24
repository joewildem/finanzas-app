import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Budget } from '@/lib/budgets'

// CU-019/CU-022 — todo el presupuesto de un usuario para un mes, en una sola consulta.
export function useBudgets(mes: string) {
  const [state, setState] = useState<{ mes: string; budgets: Budget[] | undefined }>(() => ({
    mes,
    budgets: undefined,
  }))
  const [error, setError] = useState<string | null>(null)

  // Reinicia `budgets` a `undefined` en el MISMO render donde cambia `mes` ("ajustar estado
  // durante el render", patrón documentado de React) — sin esto, hay un render transitorio donde
  // `mes` ya cambió pero `budgets` todavía trae los datos del mes anterior (el reset vía efecto no
  // corre hasta después de comprometer ese render), lo que rompía a cualquier consumidor que derive
  // estado local comparando ambos (ver el efecto de sembrado de `BudgetPage`, que llegó a fijar sus
  // montos con el mes equivocado por esta ventana).
  if (state.mes !== mes) {
    setState({ mes, budgets: undefined })
  }

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('budgets').select('*').eq('mes', mes)
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setState({ mes, budgets: data as Budget[] })
  }, [mes])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { budgets: state.budgets, error, refetch }
}
