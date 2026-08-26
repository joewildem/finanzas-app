import { useCallback, useEffect, useState } from 'react'

import { useCategoryGroups } from '@/hooks/use-category-groups'
import type { CategoryFlow } from '@/lib/categories'
import { computeCurrentPeriodRange, type Period } from '@/lib/date-periods'
import { supabase } from '@/lib/supabase'

export interface CategoryAmount {
  id: string
  nombre: string
  monto: number
}

export interface GroupDistribution {
  groupId: string
  nombre: string
  color: string
  flujo: CategoryFlow
  categorias: CategoryAmount[]
}

interface TxRow {
  category_id: string | null
  monto: number
  tipo: string
}

// CU-071 — RN-267 a RN-269. Una card por cada grupo activo (Inflow, Outflow e Investment por
// igual, RN-267), con sus categorías ordenadas de mayor a menor monto dentro del periodo (RN-268).
export function useAnalyticsCategoryDistribution(periodo: Period, customRange?: { fechaInicio: Date; fechaFin: Date }) {
  const { groups } = useCategoryGroups(false)
  const [distribucion, setDistribucion] = useState<GroupDistribution[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const fechaInicioKey = customRange?.fechaInicio.getTime()
  const fechaFinKey = customRange?.fechaFin.getTime()

  const refetch = useCallback(async () => {
    if (!groups) return

    const opts = {
      fechaInicio: fechaInicioKey !== undefined ? new Date(fechaInicioKey) : undefined,
      fechaFin: fechaFinKey !== undefined ? new Date(fechaFinKey) : undefined,
    }
    const range = periodo === 'all' ? null : computeCurrentPeriodRange(periodo, opts)
    if (periodo !== 'all' && !range) {
      setDistribucion(undefined)
      return
    }

    let query = supabase.from('transactions').select('category_id, monto, tipo').in('tipo', ['ingreso', 'gasto'])
    if (range) query = query.gte('fecha', range.from.toISOString()).lte('fecha', range.to.toISOString())

    const { data, error: txError } = await query
    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const totalsByCategory = new Map<string, number>()
    for (const row of data as TxRow[]) {
      if (!row.category_id) continue
      totalsByCategory.set(row.category_id, (totalsByCategory.get(row.category_id) ?? 0) + Math.abs(row.monto))
    }

    setDistribucion(
      groups.map(({ group, categories }) => ({
        groupId: group.id,
        nombre: group.nombre,
        color: group.color,
        flujo: group.flujo,
        categorias: categories
          .map((category) => ({ id: category.id, nombre: category.nombre, monto: totalsByCategory.get(category.id) ?? 0 }))
          .filter((c) => c.monto > 0)
          .sort((a, b) => b.monto - a.monto),
      })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, periodo, fechaInicioKey, fechaFinKey])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { distribucion, error, refetch }
}
