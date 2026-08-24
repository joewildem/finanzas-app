import { useCallback, useEffect, useState } from 'react'
import { differenceInCalendarDays, parse } from 'date-fns'

import { previousCalendarMonthRange, resolvePeriodRange, type ReportPeriodInput } from '@/lib/reports'
import { supabase } from '@/lib/supabase'

export interface TransactionFrequency {
  frecuenciaDiaria: number
  frecuenciaSemanal: number
  variacionDiariaVsMesAnterior: number | null
  variacionSemanalVsMesAnterior: number | null
}

function spanInDays(range: { from: string; toExclusive: string }): number {
  return (
    differenceInCalendarDays(parse(range.toExclusive, 'yyyy-MM-dd', new Date()), parse(range.from, 'yyyy-MM-dd', new Date())) || 1
  )
}

// CU-031 — RN-096 (solo tipo=ingreso/gasto), RN-097 (siempre compara contra el mes calendario
// inmediato anterior, sin importar el periodo elegido). Variación en `null` si el mes anterior no
// tuvo movimientos, evitando división por cero.
export function useTransactionFrequency(period: ReportPeriodInput) {
  const [data, setData] = useState<TransactionFrequency | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const range = resolvePeriodRange(period)
    const previousRange = previousCalendarMonthRange()

    const { data: currentTx, error: currentError } = await supabase
      .from('transactions')
      .select('id')
      .in('tipo', ['ingreso', 'gasto'])
      .gte('fecha', range.from)
      .lt('fecha', range.toExclusive)

    if (currentError) {
      setError(currentError.message)
      return
    }

    const { data: previousTx, error: previousError } = await supabase
      .from('transactions')
      .select('id')
      .in('tipo', ['ingreso', 'gasto'])
      .gte('fecha', previousRange.from)
      .lt('fecha', previousRange.toExclusive)

    if (previousError) {
      setError(previousError.message)
      return
    }
    setError(null)

    const currentCount = currentTx.length
    const previousCount = previousTx.length

    const dailyFreq = currentCount / spanInDays(range)
    const weeklyFreq = dailyFreq * 7
    const previousDailyFreq = previousCount / spanInDays(previousRange)
    const previousWeeklyFreq = previousDailyFreq * 7

    setData({
      frecuenciaDiaria: dailyFreq,
      frecuenciaSemanal: weeklyFreq,
      variacionDiariaVsMesAnterior: previousCount === 0 ? null : (dailyFreq - previousDailyFreq) / previousDailyFreq,
      variacionSemanalVsMesAnterior: previousCount === 0 ? null : (weeklyFreq - previousWeeklyFreq) / previousWeeklyFreq,
    })
  }, [period])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, error, refetch }
}
