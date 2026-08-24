import { useCallback, useEffect, useState } from 'react'
import { differenceInCalendarDays, parse } from 'date-fns'

import type { Account } from '@/lib/accounts'
import { resolvePeriodRange, type ReportPeriodInput } from '@/lib/reports'
import { supabase } from '@/lib/supabase'

export interface CreditCardSeriesPoint {
  punto: string
  monto: number
}

export interface CreditCardSeries {
  accountId: string
  nombre: string
  puntos: CreditCardSeriesPoint[]
}

export interface TopCategoria {
  categoria: string
  monto: number
}

// CU-026 — RN-085 (una tarjeta específica o "todas": con "todas" se devuelve una serie por tarjeta,
// no agregada, para poder compararlas), RN-086 (top de categorías por gasto — `tipo=gasto` ya
// excluye `pago_tarjeta` de por sí). Granularidad de la serie: diaria si el periodo cubre 60 días o
// menos, mensual si es más largo (decisión de implementación, no especificada en el PRD).
export function useCreditCardDetail(creditAccounts: Account[], accountId: string, period: ReportPeriodInput) {
  const [serie, setSerie] = useState<CreditCardSeries[] | undefined>(undefined)
  const [topCategorias, setTopCategorias] = useState<TopCategoria[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const accountIds = accountId === 'all' ? creditAccounts.map((a) => a.id) : [accountId]
  const accountIdsKey = accountIds.join(',')

  const refetch = useCallback(async () => {
    if (accountIds.length === 0) {
      setSerie([])
      setTopCategorias([])
      setError(null)
      return
    }

    const range = resolvePeriodRange(period)
    const { data, error: txError } = await supabase
      .from('transactions')
      .select('account_id, category_id, monto, fecha')
      .eq('tipo', 'gasto')
      .in('account_id', accountIds)
      .gte('fecha', range.from)
      .lt('fecha', range.toExclusive)

    if (txError) {
      setError(txError.message)
      return
    }

    const { data: categoriesData, error: catError } = await supabase
      .from('categories')
      .select('id, nombre')
      .eq('tipo', 'categoria')

    if (catError) {
      setError(catError.message)
      return
    }
    setError(null)

    const categoryNameById = new Map((categoriesData as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre]))
    const txs = data as { account_id: string; category_id: string | null; monto: number; fecha: string }[]

    const spanDays = differenceInCalendarDays(
      parse(range.toExclusive, 'yyyy-MM-dd', new Date()),
      parse(range.from, 'yyyy-MM-dd', new Date()),
    )
    const bucketOf = (fecha: string) => (spanDays > 60 ? fecha.slice(0, 7) : fecha.slice(0, 10))

    const seriesByAccount = new Map<string, Map<string, number>>()
    const categoryTotals = new Map<string, number>()

    for (const tx of txs) {
      const monto = Math.abs(tx.monto)
      const key = bucketOf(tx.fecha)
      if (!seriesByAccount.has(tx.account_id)) seriesByAccount.set(tx.account_id, new Map())
      const accountBuckets = seriesByAccount.get(tx.account_id)!
      accountBuckets.set(key, (accountBuckets.get(key) ?? 0) + monto)

      if (tx.category_id) {
        const nombre = categoryNameById.get(tx.category_id) ?? 'Other'
        categoryTotals.set(nombre, (categoryTotals.get(nombre) ?? 0) + monto)
      }
    }

    const serieResult: CreditCardSeries[] = accountIds.map((id) => {
      const account = creditAccounts.find((a) => a.id === id)
      const buckets = seriesByAccount.get(id) ?? new Map()
      const puntos = [...buckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([punto, monto]) => ({ punto, monto }))
      return { accountId: id, nombre: account?.nombre ?? 'Unknown', puntos }
    })

    const topResult = [...categoryTotals.entries()]
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 8)

    setSerie(serieResult)
    setTopCategorias(topResult)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsKey, period, creditAccounts])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { serie, topCategorias, error, refetch }
}
