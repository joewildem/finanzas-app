import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { SavingsGoal } from '@/lib/savings-goals'

// CU-043 — por defecto solo activas; `includeArchived` agrega las archivadas (toggle local, mismo
// patrón que `useAccounts`). Ordenadas por `fecha_limite` ascendente, metas sin fecha al final.
export function useSavingsGoals(includeArchived: boolean) {
  const [goals, setGoals] = useState<SavingsGoal[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    let query = supabase
      .from('savings_goals')
      .select('*')
      .order('fecha_limite', { ascending: true, nullsFirst: false })
    if (!includeArchived) {
      query = query.eq('status', 'active')
    }
    const { data, error } = await query
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setGoals(data as SavingsGoal[])
  }, [includeArchived])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { goals, error, refetch }
}
