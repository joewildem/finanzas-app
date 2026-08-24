import { useCallback, useEffect, useState } from 'react'

import { useCategoryGroups } from '@/hooks/use-category-groups'
import type { CategoryFlow } from '@/lib/categories'
import { resolvePeriodRange, type ReportPeriodInput } from '@/lib/reports'
import { supabase } from '@/lib/supabase'

export interface CategoryAmount {
  categoria: string
  monto: number
}

export interface GroupDistribution {
  groupId: string
  nombre: string
  color: string
  flujo: CategoryFlow
  categorias: CategoryAmount[]
}

// CU-028 — RN-090 (el ranking de gasto excluye grupos Inflow), RN-091 (las gráficas de pastel
// incluyen todos los grupos activos, Inflow y Outflow, dinámico por `flujo`; Ahorros queda fuera al
// no tener categorías propias todavía).
export function useCategoryDistribution(period: ReportPeriodInput) {
  const { groups } = useCategoryGroups(false)
  const [rankingGasto, setRankingGasto] = useState<CategoryAmount[] | undefined>(undefined)
  const [distribucionPorGrupo, setDistribucionPorGrupo] = useState<GroupDistribution[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!groups) return
    const range = resolvePeriodRange(period)

    const { data, error: txError } = await supabase
      .from('transactions')
      .select('category_id, monto, tipo')
      .in('tipo', ['ingreso', 'gasto'])
      .gte('fecha', range.from)
      .lt('fecha', range.toExclusive)

    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const categoryMeta = new Map<string, { nombre: string; groupId: string }>()
    for (const entry of groups) {
      for (const category of entry.categories) {
        categoryMeta.set(category.id, { nombre: category.nombre, groupId: entry.group.id })
      }
    }

    const perCategoryTotals = new Map<string, number>()
    for (const tx of data as { category_id: string | null; monto: number; tipo: string }[]) {
      if (!tx.category_id) continue
      perCategoryTotals.set(tx.category_id, (perCategoryTotals.get(tx.category_id) ?? 0) + Math.abs(tx.monto))
    }

    const ranking: CategoryAmount[] = []
    for (const [categoryId, monto] of perCategoryTotals) {
      const meta = categoryMeta.get(categoryId)
      if (!meta) continue
      const group = groups.find((entry) => entry.group.id === meta.groupId)?.group
      if (!group || group.flujo === 'inflow') continue
      ranking.push({ categoria: meta.nombre, monto })
    }
    ranking.sort((a, b) => b.monto - a.monto)
    setRankingGasto(ranking)

    setDistribucionPorGrupo(
      groups.map(({ group, categories }) => ({
        groupId: group.id,
        nombre: group.nombre,
        color: group.color,
        flujo: group.flujo,
        categorias: categories
          .map((category) => ({ categoria: category.nombre, monto: perCategoryTotals.get(category.id) ?? 0 }))
          .filter((c) => c.monto > 0)
          .sort((a, b) => b.monto - a.monto),
      })),
    )
  }, [groups, period])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { rankingGasto, distribucionPorGrupo, error, refetch }
}
