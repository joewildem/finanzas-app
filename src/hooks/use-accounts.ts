import { useCallback, useEffect, useState } from 'react'

import { useDataVersion } from '@/hooks/use-data-version'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/lib/accounts'

// CU-002 — por defecto solo activas; `includeArchived` agrega las archivadas (toggle local, no
// query param — el CU descartó explícitamente un buscador/filtro dedicado).
export function useAccounts(includeArchived: boolean) {
  const [accounts, setAccounts] = useState<Account[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    let query = supabase.from('accounts').select('*').order('created_at', { ascending: true })
    if (!includeArchived) {
      query = query.eq('status', 'active')
    }
    const { data, error } = await query
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setAccounts(data as Account[])
  }, [includeArchived])

  // Vuelve a consultar cuando cualquier parte de la app escribe en Supabase, para que el
  // Dashboard no quede desactualizado hasta recargar la página — ver `src/lib/data-refresh.ts`.
  const dataVersion = useDataVersion()
  useEffect(() => {
    refetch()
  }, [refetch, dataVersion])

  return { accounts, error, refetch }
}
