import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Subscription } from '@/lib/subscriptions'

// CU-079 — trae todas las suscripciones del usuario de una sola vez, activas y archivadas.
//
// A diferencia de los demás módulos, aquí no hay una consulta por mes ni agregaciones en el
// servidor: los cobros de un mes se derivan de `fecha_inicio` y `ciclo` (ver computeOccurrences), y
// el conjunto completo son unas cuantas decenas de filas. Cambiar de mes en la pantalla no vuelve a
// pegarle a la base.
//
// Las archivadas se traen siempre porque siguen apareciendo en los meses anteriores a su archivado;
// filtrarlas en el servidor haría desaparecer histórico que sí ocurrió. Quién se muestra en cada
// bloque lo decide la pantalla.
export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<Subscription[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setSubscriptions(data as Subscription[])
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { subscriptions, error, refetch }
}
