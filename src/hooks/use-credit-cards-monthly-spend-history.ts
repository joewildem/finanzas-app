import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, isAfter, parse } from 'date-fns'

import type { Account } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'

export interface CreditCardSpendPoint {
  account_id: string
  nombre: string
  color: string
  gasto: number
}

export interface MonthlySpendPoint {
  mes: string
  tarjetas: CreditCardSpendPoint[]
}

// CU-064 — RN-238 (solo credito activas), RN-239 (gasto del mes = suma en valor absoluto de
// `tipo=gasto` dentro del mes calendario, sin arrastre — a diferencia del balance de CU-062, un mes
// sin gasto es, en efecto, cero). Meses antes de `created_at` de la tarjeta van en 0.
export function useCreditCardsMonthlySpendHistory(creditAccounts: Account[], anio: number) {
  const [meses, setMeses] = useState<MonthlySpendPoint[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const accountIdsKey = creditAccounts.map((a) => a.id).join(',')

  const refetch = useCallback(async () => {
    if (creditAccounts.length === 0) {
      setMeses(
        Array.from({ length: 12 }, (_, i) => ({
          mes: `${anio}-${String(i + 1).padStart(2, '0')}`,
          tarjetas: [],
        })),
      )
      setError(null)
      return
    }

    const yearStart = `${anio}-01-01`
    const yearEndExclusive = `${anio + 1}-01-01`
    const { data, error: txError } = await supabase
      .from('transactions')
      .select('account_id, monto, fecha')
      .eq('tipo', 'gasto')
      .in(
        'account_id',
        creditAccounts.map((a) => a.id),
      )
      .gte('fecha', yearStart)
      .lt('fecha', yearEndExclusive)

    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const txs = data as { account_id: string; monto: number; fecha: string }[]

    const points: MonthlySpendPoint[] = Array.from({ length: 12 }, (_, i) => {
      const mes = `${anio}-${String(i + 1).padStart(2, '0')}`
      const monthStart = parse(mes, 'yyyy-MM', new Date())
      const monthEnd = endOfMonth(monthStart)

      const tarjetas: CreditCardSpendPoint[] = creditAccounts.map((account) => {
        const createdAt = new Date(account.created_at)
        const gasto = isAfter(createdAt, monthEnd)
          ? 0
          : txs
              .filter((t) => t.account_id === account.id && t.fecha.slice(0, 7) === mes)
              .reduce((sum, t) => sum + Math.abs(t.monto), 0)

        return { account_id: account.id, nombre: account.nombre, color: account.color, gasto }
      })

      return { mes, tarjetas }
    })

    setMeses(points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsKey, anio])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { meses, error, refetch }
}
