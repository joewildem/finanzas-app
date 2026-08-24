import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, isAfter, parse } from 'date-fns'

import type { Account } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'

export interface AccountBalancePoint {
  account_id: string
  nombre: string
  color: string
  balance: number | null
}

export interface MonthlyBalancePoint {
  mes: string
  cuentas: AccountBalancePoint[]
}

// CU-024 — RN-078 (solo debito/efectivo activas), RN-079 (balance de cierre de mes = saldo_inicial +
// movimientos con fecha <= fin de mes, derivado en tiempo de consulta), RN-080 (arrastre hacia
// adelante en meses sin movimientos — se obtiene gratis al sumar acumulado en vez de por-mes-aislado).
// Meses antes de `created_at` de la cuenta van en 0 (todavía no existía); meses futuros respecto a
// hoy van en `null` (sin datos, no transcurridos).
export function useAccountsMonthlyBalance(anio: number) {
  const [meses, setMeses] = useState<MonthlyBalancePoint[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data: accountsData, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .in('tipo', ['debito', 'efectivo'])
      .eq('status', 'active')

    if (accountsError) {
      setError(accountsError.message)
      return
    }
    const accounts = accountsData as Account[]

    if (accounts.length === 0) {
      setError(null)
      setMeses(
        Array.from({ length: 12 }, (_, i) => ({
          mes: `${anio}-${String(i + 1).padStart(2, '0')}`,
          cuentas: [],
        })),
      )
      return
    }

    const yearEndExclusive = `${anio + 1}-01-01`
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('account_id, monto, fecha')
      .in(
        'account_id',
        accounts.map((a) => a.id),
      )
      .lt('fecha', yearEndExclusive)
      .order('fecha', { ascending: true })

    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const txs = txData as { account_id: string; monto: number; fecha: string }[]
    const today = new Date()

    const points: MonthlyBalancePoint[] = Array.from({ length: 12 }, (_, i) => {
      const mes = `${anio}-${String(i + 1).padStart(2, '0')}`
      const monthStart = parse(mes, 'yyyy-MM', new Date())
      const monthEnd = endOfMonth(monthStart)
      // El mes en curso (que todavía no cierra) no es "futuro" — solo lo son los meses que ni
      // siquiera han comenzado. No hay movimientos después de hoy de cualquier forma, así que sumar
      // hasta `monthEnd` en un mes en curso da el mismo resultado que sumar hasta hoy.
      const isFuture = isAfter(monthStart, today)

      const cuentas: AccountBalancePoint[] = accounts.map((account) => {
        const createdAt = new Date(account.created_at)
        if (isAfter(createdAt, monthEnd)) {
          return { account_id: account.id, nombre: account.nombre, color: account.color, balance: 0 }
        }
        if (isFuture) {
          return { account_id: account.id, nombre: account.nombre, color: account.color, balance: null }
        }
        const movimientos = txs
          .filter((t) => t.account_id === account.id && !isAfter(new Date(t.fecha), monthEnd))
          .reduce((sum, t) => sum + t.monto, 0)
        return {
          account_id: account.id,
          nombre: account.nombre,
          color: account.color,
          balance: account.saldo_inicial + movimientos,
        }
      })

      return { mes, cuentas }
    })

    setMeses(points)
  }, [anio])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { meses, error, refetch }
}
