import { useCallback, useEffect, useState } from 'react'

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
        .order('fecha', { ascending: false }),
    ])

    if (accountResult.error) {
      setError(accountResult.error.message)
      return
    }

    setError(null)
    setAccount((accountResult.data as Account | null) ?? null)
    setMovements((movementsResult.data as AccountTransaction[] | null) ?? [])
  }, [accountId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { account, movements, error, refetch }
}
