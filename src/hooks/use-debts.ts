import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Debt } from '@/lib/debts'

// CU-056 — por defecto solo activas; `includeArchived` agrega las archivadas (toggle local, mismo
// patrón que `useSavingsGoals`). Ordenadas por `fecha_liquidacion_estimada` ascendente, deudas sin
// fecha al final (RN-205).
export function useDebts(includeArchived: boolean) {
  const [debts, setDebts] = useState<Debt[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    let query = supabase
      .from('debts')
      .select('*')
      .order('fecha_liquidacion_estimada', { ascending: true, nullsFirst: false })
    if (!includeArchived) {
      query = query.eq('status', 'active')
    }
    const { data, error } = await query
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setDebts(data as Debt[])
  }, [includeArchived])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { debts, error, refetch }
}
