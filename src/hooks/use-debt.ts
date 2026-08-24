import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Debt } from '@/lib/debts'
import type { Transaction } from '@/lib/transactions'

export interface DebtPayment extends Transaction {
  account: { nombre: string; color: string } | null
}

// CU-057 — detalle + historial de pagos de una deuda. Una deuda inexistente o de otro usuario
// simplemente no vuelve por RLS, mismo criterio "not found" que `useSavingsGoal`.
export function useDebt(debtId: string | undefined) {
  const [debt, setDebt] = useState<Debt | null | undefined>(undefined)
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!debtId) return

    const [debtResult, paymentsResult] = await Promise.all([
      supabase.from('debts').select('*').eq('id', debtId).maybeSingle(),
      supabase
        .from('transactions')
        .select('*, account:accounts(nombre,color)')
        .eq('deuda_id', debtId)
        .order('fecha', { ascending: false }),
    ])

    if (debtResult.error) {
      setError(debtResult.error.message)
      return
    }

    setError(null)
    setDebt((debtResult.data as Debt | null) ?? null)
    setPayments((paymentsResult.data as DebtPayment[] | null) ?? [])
  }, [debtId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { debt, payments, error, refetch }
}
