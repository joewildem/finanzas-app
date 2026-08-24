import { useCallback, useEffect, useState } from 'react'

import { useCategoryGroups } from '@/hooks/use-category-groups'
import type { CategoryFlow } from '@/lib/categories'
import { monthKeysInRange, resolvePeriodRange, type ReportPeriodInput } from '@/lib/reports'
import { supabase } from '@/lib/supabase'

export interface GroupSummary {
  groupId: string
  nombre: string
  color: string
  flujo: CategoryFlow
  monto: number
}

// CU-027 — RN-087 (una card por grupo activo + Ahorros, dinámico por `flujo` en vez de nombres
// fijos — ver decisión en docs/pdr/reportes.md), RN-089 (monto = suma de ingreso/gasto de las
// categorías del grupo en el rango), RN-087 alt. flow (Ahorros suma el presupuestado de cada mes
// calendario cubierto por el rango, `0` en los meses sin presupuesto configurado).
export function useMonthlySummaryByGroup(period: ReportPeriodInput) {
  const { groups } = useCategoryGroups(false)
  const [gruposReales, setGruposReales] = useState<GroupSummary[] | undefined>(undefined)
  const [ahorros, setAhorros] = useState<number | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!groups) return
    const range = resolvePeriodRange(period)

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('category_id, monto, tipo')
      .in('tipo', ['ingreso', 'gasto'])
      .gte('fecha', range.from)
      .lt('fecha', range.toExclusive)

    if (txError) {
      setError(txError.message)
      return
    }

    const categoryToGroupId = new Map<string, string>()
    for (const entry of groups) {
      for (const category of entry.categories) categoryToGroupId.set(category.id, entry.group.id)
    }

    const totals = new Map<string, number>()
    for (const tx of txData as { category_id: string | null; monto: number; tipo: string }[]) {
      if (!tx.category_id) continue
      const groupId = categoryToGroupId.get(tx.category_id)
      if (!groupId) continue
      totals.set(groupId, (totals.get(groupId) ?? 0) + Math.abs(tx.monto))
    }

    setGruposReales(
      groups.map(({ group }) => ({
        groupId: group.id,
        nombre: group.nombre,
        color: group.color,
        flujo: group.flujo,
        monto: totals.get(group.id) ?? 0,
      })),
    )

    // RN-087 de [[reportes]] queda desactualizada por el cierre de Ahorros y Metas (2026-08-22):
    // ya no existe el pseudo-registro único `categoria_reservada` — cada meta activa se presupuesta
    // por separado vía `budgets.meta_id`. Traducción mínima para no romper el build mientras le
    // toca su turno a Reportes: suma todos los renglones de meta presupuestados del mes en vez del
    // único renglón "ahorros" de antes. Sin desglose por meta ni corrección del resto del CU-027.
    const monthKeys = monthKeysInRange(range)
    const { data: budgetsData, error: budgetsError } = await supabase
      .from('budgets')
      .select('mes, monto')
      .not('meta_id', 'is', null)
      .in('mes', monthKeys)

    if (budgetsError) {
      setError(budgetsError.message)
      return
    }
    setError(null)
    setAhorros((budgetsData as { mes: string; monto: number }[]).reduce((sum, b) => sum + b.monto, 0))
  }, [groups, period])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { gruposReales, ahorros, error, refetch }
}
