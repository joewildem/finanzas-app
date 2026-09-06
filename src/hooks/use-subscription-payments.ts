import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'

import { supabase } from '@/lib/supabase'
import { chargeKey } from '@/lib/subscriptions'
import { useAuthSession } from '@/lib/auth-context'

// CU-083 — los cobros marcados como pagados dentro de un rango de fechas, como un conjunto de
// llaves `subscripcion|fecha`. La presencia de la fila es el estado: no hay booleano, marcar
// inserta y desmarcar borra (ver la migración 20260906100000).
//
// El conjunto se mantiene también en local para que la casilla responda de inmediato; se
// resincroniza con el servidor en cada refetch y al cambiar de rango.
export function useSubscriptionPayments(from: Date, to: Date) {
  const session = useAuthSession()
  const desde = format(from, 'yyyy-MM-dd')
  const hasta = format(to, 'yyyy-MM-dd')

  const [state, setState] = useState<{ desde: string; paid: Set<string> | undefined }>(() => ({
    desde,
    paid: undefined,
  }))
  const [error, setError] = useState<string | null>(null)

  // Mismo ajuste "durante el render" que useMsiPayments — evita que el rango y los pagos queden
  // desincronizados por un render al cambiar de mes.
  if (state.desde !== desde) {
    setState({ desde, paid: undefined })
  }

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('subscription_payments')
      .select('subscription_id, fecha')
      .gte('fecha', desde)
      .lte('fecha', hasta)

    if (error) {
      setError(error.message)
      return
    }
    setError(null)

    const rows = data as { subscription_id: string; fecha: string }[]
    setState({
      desde,
      paid: new Set(rows.map((row) => `${row.subscription_id}|${row.fecha}`)),
    })
  }, [desde, hasta])

  useEffect(() => {
    refetch()
  }, [refetch])

  const setPaid = useCallback(
    async (subscriptionId: string, fecha: Date, paid: boolean) => {
      const key = chargeKey(subscriptionId, fecha)

      setState((prev) => {
        if (!prev.paid) return prev
        const next = new Set(prev.paid)
        if (paid) next.add(key)
        else next.delete(key)
        return { ...prev, paid: next }
      })

      const { error } = paid
        ? await supabase.from('subscription_payments').insert({
            user_id: session.user.id,
            subscription_id: subscriptionId,
            fecha: format(fecha, 'yyyy-MM-dd'),
          })
        : await supabase
            .from('subscription_payments')
            .delete()
            .eq('subscription_id', subscriptionId)
            .eq('fecha', format(fecha, 'yyyy-MM-dd'))

      // Ante un fallo se vuelve a leer del servidor en vez de deshacer a mano: lo que quedó escrito
      // es la única fuente confiable del estado.
      if (error) {
        setError(error.message)
        refetch()
      }
    },
    [session.user.id, refetch],
  )

  return { paid: state.paid, error, setPaid, refetch }
}
