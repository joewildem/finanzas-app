import { useCallback, useEffect, useState } from 'react'

import { useAuthSession } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'

export interface NetworthGoal {
  user_id: string
  monto_objetivo: number
}

// CU-068 — RN-254: un único registro por usuario, sin historial. `goal` queda en `null` (no
// `undefined`) cuando la consulta ya resolvió y el usuario simplemente no ha configurado ninguna
// meta todavía (RN-256) — `undefined` sigue significando "aún cargando".
export function useNetworthGoal() {
  const session = useAuthSession()
  const [goal, setGoal] = useState<NetworthGoal | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('networth_goals').select('user_id, monto_objetivo').maybeSingle()
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setGoal(data as NetworthGoal | null)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const save = useCallback(
    async (montoObjetivo: number) => {
      const { error } = await supabase
        .from('networth_goals')
        .upsert({ user_id: session.user.id, monto_objetivo: montoObjetivo }, { onConflict: 'user_id' })
      if (error) return { error: error.message }
      await refetch()
      return { error: null }
    },
    [session.user.id, refetch],
  )

  return { goal, error, refetch, save }
}
