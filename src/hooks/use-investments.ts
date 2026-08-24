import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Investment } from '@/lib/investments'

// CU-050 — a diferencia de useSavingsGoals, no hay toggle de "incluir archivadas": CU-050 siempre
// muestra ambas tablas (activos e inactivos) a la vez, así que se trae el portafolio completo en
// una sola consulta y la página separa por `status`.
export function useInvestments() {
  const [investments, setInvestments] = useState<Investment[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('investments').select('*').order('ticker', { ascending: true })
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setInvestments(data as Investment[])
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { investments, error, refetch }
}
