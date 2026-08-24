import { useCallback, useEffect, useState } from 'react'

import type { AccountType } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'
import type { Transaction, TransactionType } from '@/lib/transactions'

export interface TransactionWithRelations extends Transaction {
  account: { nombre: string; color: string; tipo: AccountType } | null
  category: { nombre: string; icono: string | null } | null
}

export interface TransactionFilters {
  tipo?: TransactionType | 'all'
  accountId?: string
  categoryId?: string
  fechaDesde?: string
  fechaHasta?: string
}

// CU-016 — historial general, sin RPC (la política `transactions_select_own` ya acota a las
// propias). Usa el embedding de PostgREST sobre las FK a `accounts`/`categories` para traer el
// nombre de cuenta/categoría en la misma consulta, en vez de resolverlos por separado en cada fila.
export function useTransactions(filters: TransactionFilters) {
  const [transactions, setTransactions] = useState<TransactionWithRelations[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const { tipo, accountId, categoryId, fechaDesde, fechaHasta } = filters

  const refetch = useCallback(async () => {
    let query = supabase
      .from('transactions')
      .select('*, account:accounts(nombre,color,tipo), category:categories(nombre,icono)')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (tipo && tipo !== 'all') query = query.eq('tipo', tipo)
    if (accountId) query = query.eq('account_id', accountId)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (fechaDesde) query = query.gte('fecha', fechaDesde)
    if (fechaHasta) query = query.lte('fecha', fechaHasta)

    const { data, error } = await query
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setTransactions(data as unknown as TransactionWithRelations[])
  }, [tipo, accountId, categoryId, fechaDesde, fechaHasta])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { transactions, error, refetch }
}
