import { useCallback, useEffect, useState } from 'react'

import { useCategoryGroups } from '@/hooks/use-category-groups'
import { buildPeriodAmount, type PeriodAmount } from '@/lib/analytics'
import { computeCurrentPeriodRange, computePreviousPeriodRange, type Period } from '@/lib/date-periods'
import { supabase } from '@/lib/supabase'

export interface AnalyticsSummary {
  income: PeriodAmount
  expenses: PeriodAmount
  savings: PeriodAmount
  investment: PeriodAmount
}

interface TxRow {
  category_id: string | null
  monto: number
  tipo: string
  fecha: string
}

// CU-069 — RN-257 a RN-263. Trae en una sola consulta las transacciones relevantes que caen en la
// unión del rango actual y el rango de comparación (RN-261), y separa cada suma en cliente por
// fecha — evita dos consultas (una por rango).
export function useAnalyticsSummary(periodo: Period, customRange?: { fechaInicio: Date; fechaFin: Date }) {
  const { groups } = useCategoryGroups(false)
  const [summary, setSummary] = useState<AnalyticsSummary | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const fechaInicioKey = customRange?.fechaInicio.getTime()
  const fechaFinKey = customRange?.fechaFin.getTime()

  const refetch = useCallback(async () => {
    if (!groups) return

    const opts = {
      fechaInicio: fechaInicioKey !== undefined ? new Date(fechaInicioKey) : undefined,
      fechaFin: fechaFinKey !== undefined ? new Date(fechaFinKey) : undefined,
    }

    // RN-263: "all" no tiene periodo de comparación — se consulta sin límite inferior de fecha.
    const current = periodo === 'all' ? null : computeCurrentPeriodRange(periodo, opts)
    const previous = periodo === 'all' ? null : computePreviousPeriodRange(periodo, opts)
    if (periodo !== 'all' && !current) {
      setSummary(undefined)
      return
    }

    let query = supabase
      .from('transactions')
      .select('category_id, monto, tipo, fecha')
      .in('tipo', ['ingreso', 'gasto', 'aportacion_meta', 'retiro_meta'])
    if (previous) query = query.gte('fecha', previous.from.toISOString())
    else if (current) query = query.gte('fecha', current.from.toISOString())
    if (current) query = query.lte('fecha', current.to.toISOString())

    const { data, error: txError } = await query
    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const groupFlowByCategory = new Map<string, string>()
    for (const entry of groups) {
      for (const category of entry.categories) groupFlowByCategory.set(category.id, entry.group.flujo)
    }

    const rows = data as TxRow[]
    const inCurrentRange = (fecha: string) => !current || new Date(fecha) >= current.from
    const inPreviousRange = (fecha: string) => previous && new Date(fecha) >= previous.from && new Date(fecha) <= previous.to

    let incomeActual = 0
    let incomeAnterior = 0
    let expensesActual = 0
    let expensesAnterior = 0
    let investmentActual = 0
    let investmentAnterior = 0
    let savingsActual = 0
    let savingsAnterior = 0

    for (const row of rows) {
      const esActual = inCurrentRange(row.fecha)
      const esAnterior = inPreviousRange(row.fecha)
      if (!esActual && !esAnterior) continue

      if (row.tipo === 'aportacion_meta' || row.tipo === 'retiro_meta') {
        // RN-259: signo invertido — aportación (monto negativo) suma, retiro (positivo) resta.
        if (esActual) savingsActual += -row.monto
        if (esAnterior) savingsAnterior += -row.monto
        continue
      }

      const flujo = row.category_id ? groupFlowByCategory.get(row.category_id) : undefined
      if (row.tipo === 'ingreso' && flujo === 'inflow') {
        if (esActual) incomeActual += row.monto
        if (esAnterior) incomeAnterior += row.monto
      } else if (row.tipo === 'gasto' && flujo === 'outflow') {
        if (esActual) expensesActual += Math.abs(row.monto)
        if (esAnterior) expensesAnterior += Math.abs(row.monto)
      } else if (row.tipo === 'gasto' && flujo === 'investment') {
        if (esActual) investmentActual += Math.abs(row.monto)
        if (esAnterior) investmentAnterior += Math.abs(row.monto)
      }
    }

    setSummary({
      income: buildPeriodAmount(incomeActual, previous ? incomeAnterior : null),
      expenses: buildPeriodAmount(expensesActual, previous ? expensesAnterior : null),
      savings: buildPeriodAmount(savingsActual, previous ? savingsAnterior : null),
      investment: buildPeriodAmount(investmentActual, previous ? investmentAnterior : null),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, periodo, fechaInicioKey, fechaFinKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { summary, error, refetch }
}
