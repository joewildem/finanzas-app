import { useCallback, useEffect, useState } from 'react'

import { useDataVersion } from '@/hooks/use-data-version'
import { supabase } from '@/lib/supabase'
import type { Account, AccountTransaction } from '@/lib/accounts'

// CU-003 — detalle + historial de movimientos. Una cuenta inexistente o de otro usuario
// simplemente no vuelve por RLS (RN-008): ambos casos colapsan al mismo estado "not found" sin
// código extra para distinguirlos (mitigación IDOR).
export function useAccount(accountId: string | undefined) {
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  const [movements, setMovements] = useState<AccountTransaction[]>([])
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!accountId) return

    const [accountResult, movementsResult] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', accountId).maybeSingle(),
      supabase
        .from('transactions')
        .select('*')
        .eq('account_id', accountId)
        .order('fecha', { ascending: false })
        // La fecha ya no lleva hora: sin desempate, dos movimientos del mismo día salían en orden
        // arbitrario y podían intercambiarse entre consultas.
        .order('created_at', { ascending: false }),
    ])

    if (accountResult.error) {
      setError(accountResult.error.message)
      return
    }

    setError(null)
    setAccount((accountResult.data as Account | null) ?? null)
    setMovements((movementsResult.data as AccountTransaction[] | null) ?? [])
  }, [accountId])

  // RN-332: vuelve a consultar ante cualquier escritura. Sin esto, registrar un pago a la tarjeta
  // desde el botón global dejaba el calendario de pagos mostrando el estado anterior.
  const dataVersion = useDataVersion()
  useEffect(() => {
    refetch()
  }, [refetch, dataVersion])

  return { account, movements, error, refetch }
}
