import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { GoalMovement, SavingsGoal } from '@/lib/savings-goals'

// CU-044 — detalle + historial de movimientos de una meta. Una meta inexistente o de otro usuario
// simplemente no vuelve por RLS, mismo criterio "not found" sin código extra que `useAccount`.
//
// El historial sale de `savings_goal_movements` y no de `transactions` (RN-335): así incluye los
// ajustes de saldo (CU-084), que no son transacciones porque no mueven ninguna cuenta. La vista ya
// trae el nombre de la cuenta, `null` en los ajustes.
export function useSavingsGoal(goalId: string | undefined) {
  const [goal, setGoal] = useState<SavingsGoal | null | undefined>(undefined)
  const [movements, setMovements] = useState<GoalMovement[]>([])
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!goalId) return

    const [goalResult, movementsResult] = await Promise.all([
      supabase.from('savings_goals').select('*').eq('id', goalId).maybeSingle(),
      supabase
        .from('savings_goal_movements')
        .select('*')
        .eq('meta_id', goalId)
        .order('fecha', { ascending: false }),
    ])

    if (goalResult.error) {
      setError(goalResult.error.message)
      return
    }

    setError(null)
    setGoal((goalResult.data as SavingsGoal | null) ?? null)
    setMovements((movementsResult.data as GoalMovement[] | null) ?? [])
  }, [goalId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { goal, movements, error, refetch }
}
