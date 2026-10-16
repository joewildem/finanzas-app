import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { Debt } from '@/lib/debts'

// Una fila de `debt_movements`: un pago normal (`pago_deuda`, con su cuenta) o uno registrado sin
// cuenta (`pago_sin_cuenta`, RN-360). El historial los muestra juntos porque ambos son pagos a esta
// deuda; lo único que cambia es si hubo cuenta que mover.
export interface DebtPayment {
  id: string
  user_id: string
  deuda_id: string
  origen: 'pago_deuda' | 'pago_sin_cuenta'
  account_id: string | null
  account_nombre: string | null
  monto_capital: number
  monto_interes: number
  monto: number
  fecha: string
  nota: string | null
  created_at: string
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
        .from('debt_movements')
        .select('*')
        .eq('deuda_id', debtId)
        .order('fecha', { ascending: false })
        // La fecha ya no lleva hora: sin desempate, dos movimientos del mismo día salían en orden
        // arbitrario y podían intercambiarse entre consultas.
        .order('created_at', { ascending: false }),
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
