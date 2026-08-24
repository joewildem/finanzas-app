import { useCallback, useEffect, useState } from 'react'

import { useCategoryGroups } from '@/hooks/use-category-groups'
import { resolvePeriodRange, type ReportPeriodInput } from '@/lib/reports'
import { supabase } from '@/lib/supabase'

// RN-094 excluye por nombre exacto el grupo "Investment" del cálculo de gasto — caso especial
// deliberado, sin generalizar (mismo precedente que el chip "Investment" del modal de
// transacciones, ver src/components/transactions/add-transaction-dialog.tsx).
const EXCLUDED_GROUP_NAME = 'Investment'

// CU-030 — RN-094 (gasto = grupos Outflow excepto "Investment"), RN-095 (transferencia/pago_tarjeta/
// ajuste nunca cuentan, ya excluidos por el filtro `tipo in (ingreso, gasto)`).
export function useIncomeVsExpenses(period: ReportPeriodInput) {
  const { groups } = useCategoryGroups(false)
  const [ingreso, setIngreso] = useState<number | undefined>(undefined)
  const [gasto, setGasto] = useState<number | undefined>(undefined)
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

    const excludedGroupIds = new Set(
      groups.filter((entry) => entry.group.nombre === EXCLUDED_GROUP_NAME).map((entry) => entry.group.id),
    )
    const categoryToGroupId = new Map<string, string>()
    for (const entry of groups) {
      for (const category of entry.categories) categoryToGroupId.set(category.id, entry.group.id)
    }

    let ingresoSum = 0
    let gastoSum = 0
    for (const tx of data as { category_id: string | null; monto: number; tipo: string }[]) {
      if (tx.tipo === 'ingreso') {
        ingresoSum += tx.monto
        continue
      }
      const groupId = tx.category_id ? categoryToGroupId.get(tx.category_id) : undefined
      if (groupId && excludedGroupIds.has(groupId)) continue
      gastoSum += Math.abs(tx.monto)
    }

    setIngreso(ingresoSum)
    setGasto(gastoSum)
  }, [groups, period])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { ingreso, gasto, error, refetch }
}
