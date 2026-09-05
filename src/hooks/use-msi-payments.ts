import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'

// Pagos capturados a mano contra la parcialidad de cada plan en un mes, indexados por el id de la
// compra. Es el único dato de MSI que la aplicación no puede derivar: un abono a la tarjeta es un
// monto único que no dice qué parte corresponde a qué plan (ver la migración 20260904110000).
export function useMsiPayments(mes: string) {
  const [state, setState] = useState<{ mes: string; payments: Record<string, number> | undefined }>(() => ({
    mes,
    payments: undefined,
  }))
  const [error, setError] = useState<string | null>(null)

  // Mismo ajuste "durante el render" que useMonthlyActuals — evita que `mes` y los pagos queden
  // desincronizados por un render al cambiar de mes.
  if (state.mes !== mes) {
    setState({ mes, payments: undefined })
  }

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('msi_payments')
      .select('msi_transaction_id, monto')
      .eq('mes', mes)

    if (error) {
      setError(error.message)
      return
    }
    setError(null)

    const totals: Record<string, number> = {}
    for (const row of data as { msi_transaction_id: string; monto: number }[]) {
      totals[row.msi_transaction_id] = row.monto
    }
    setState({ mes, payments: totals })
  }, [mes])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { payments: state.payments, error, refetch }
}
