import { useCallback, useEffect, useState } from 'react'

import type { MsiPlan } from '@/lib/msi'
import { supabase } from '@/lib/supabase'

interface MsiPlanRow {
  id: string
  account_id: string
  concepto: string
  monto: number
  nota: string | null
  fecha: string
  msi_meses: number
  msi_mes_inicio: string
  msi_liquidado_mes: string | null
  account: { nombre: string } | null
}

// No hay tabla propia de "planes MSI" — cada plan es un movimiento `tipo = 'compra_msi'` (ver la
// migración 20260904100000). Se traen todos, sin filtrar por mes, porque el volumen de compras a
// meses de un solo usuario es bajo; cada consumidor deriva "activo en el mes X" con lib/msi.
export function useMsiPlans() {
  const [plans, setPlans] = useState<MsiPlan[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, account_id, concepto, monto, nota, fecha, msi_meses, msi_mes_inicio, msi_liquidado_mes, account:accounts(nombre)')
      .eq('tipo', 'compra_msi')
      .order('fecha', { ascending: false })

    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setPlans(
      (data as unknown as MsiPlanRow[]).map((row) => ({
        id: row.id,
        accountId: row.account_id,
        accountNombre: row.account?.nombre ?? '',
        concepto: row.concepto,
        monto: Math.abs(row.monto),
        meses: row.msi_meses,
        fecha: row.fecha,
        mesInicio: row.msi_mes_inicio,
        liquidadoMes: row.msi_liquidado_mes,
        nota: row.nota,
      })),
    )
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { plans, error, refetch }
}
