import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, parse, startOfMonth } from 'date-fns'

import { useCategoryGroups } from '@/hooks/use-category-groups'
import { computePeriodMonths, type Period } from '@/lib/date-periods'
import { supabase } from '@/lib/supabase'

export interface CashFlowPoint {
  mes: string
  income: number
  expenses: number
}

interface TxRow {
  category_id: string | null
  monto: number
  tipo: string
  fecha: string
}

// CU-070 — RN-264 a RN-266. Granularidad siempre mensual (RN-264); Income/Expenses de cada mes
// usan los mismos criterios de RN-257/RN-258 (CU-069), acotados a ese mes.
export function useAnalyticsCashFlow(periodo: Period, customRange?: { fechaInicio: Date; fechaFin: Date }) {
  const { groups } = useCategoryGroups(false)
  const [meses, setMeses] = useState<CashFlowPoint[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const fechaInicioKey = customRange?.fechaInicio.getTime()
  const fechaFinKey = customRange?.fechaFin.getTime()

  const refetch = useCallback(async () => {
    if (!groups) return

    const months = computePeriodMonths(periodo, {
      fechaInicio: fechaInicioKey !== undefined ? new Date(fechaInicioKey) : undefined,
      fechaFin: fechaFinKey !== undefined ? new Date(fechaFinKey) : undefined,
    })
    if (months.length === 0) {
      setMeses([])
      return
    }

    const rangeFrom = startOfMonth(parse(months[0], 'yyyy-MM', new Date()))
    const rangeTo = endOfMonth(parse(months[months.length - 1], 'yyyy-MM', new Date()))

    const { data, error: txError } = await supabase
      .from('transactions')
      .select('category_id, monto, tipo, fecha')
      .in('tipo', ['ingreso', 'gasto'])
      .gte('fecha', rangeFrom.toISOString())
      .lte('fecha', rangeTo.toISOString())

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
    const points: CashFlowPoint[] = months.map((mes) => {
      let income = 0
      let expenses = 0
      for (const row of rows) {
        if (row.fecha.slice(0, 7) !== mes) continue
        const flujo = row.category_id ? groupFlowByCategory.get(row.category_id) : undefined
        if (row.tipo === 'ingreso' && flujo === 'inflow') income += row.monto
        else if (row.tipo === 'gasto' && flujo === 'outflow') expenses += Math.abs(row.monto)
      }
      return { mes, income, expenses }
    })

    setMeses(points)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, periodo, fechaInicioKey, fechaFinKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { meses, error, refetch }
}
