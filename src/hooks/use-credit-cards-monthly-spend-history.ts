import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, isAfter, parse } from 'date-fns'

import { useDataVersion } from '@/hooks/use-data-version'
import type { Account } from '@/lib/accounts'
import { parseDate } from '@/lib/dates'
import { statementMonthOf } from '@/lib/statements'
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

    // La ventana arranca un mes antes del año: con corte a mitad de mes, lo gastado en la segunda
    // quincena de diciembre cierra en enero del año siguiente y tiene que entrar en esta consulta.
    const yearStart = `${anio - 1}-12-01`
    const yearEndExclusive = `${anio + 1}-01-01`
    const { data, error: txError } = await supabase
      .from('transactions')
      .select('account_id, monto, fecha')
      // RN-355: los ajustes cuentan aquí — son dinero cargado a la tarjeta, solo que sin categoría.
      .in('tipo', ['gasto', 'ajuste'])
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
              .filter(
                (t) =>
                  t.account_id === account.id &&
                  // RN-349: el gasto pertenece al mes en que CIERRA su periodo de facturación, no al
                  // mes natural en que se hizo. Sin día de corte capturado se cae al mes natural.
                  (account.dia_corte == null
                    ? t.fecha.slice(0, 7)
                    : statementMonthOf(parseDate(t.fecha), account.dia_corte)) === mes,
              )
              .reduce((sum, t) => sum - t.monto, 0)

        return { account_id: account.id, nombre: account.nombre, color: account.color, gasto }
      })

      return { mes, tarjetas }
    })

    setMeses(points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsKey, anio])

  // Vuelve a consultar cuando cualquier parte de la app escribe en Supabase, para que el
  // Dashboard no quede desactualizado hasta recargar la página — ver `src/lib/data-refresh.ts`.
  const dataVersion = useDataVersion()
  useEffect(() => {
    refetch()
  }, [refetch, dataVersion])

  return { meses, error, refetch }
}
