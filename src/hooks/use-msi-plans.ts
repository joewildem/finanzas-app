import { useCallback, useEffect, useState } from 'react'

import type { MsiPlan } from '@/lib/msi'
import { useDataVersion } from '@/hooks/use-data-version'
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
  account: { nombre: string; status: string } | null
}

// No hay tabla propia de "planes MSI" — cada plan es un movimiento `tipo = 'compra_msi'` (ver la
// migración 20260904100000). Se traen todos, sin filtrar por mes, porque el volumen de compras a
// meses de un solo usuario es bajo; cada consumidor deriva "activo en el mes X" con lib/msi.
//
// RN-359: por omisión se devuelven **solo los planes de tarjetas activas**. Archivar una tarjeta la
// retira de la operación diaria, y sus parcialidades no tienen por qué seguir ocupando un renglón
// en Presupuesto ni sumando a lo que hay que pagar. El caso que lo destapó: renombrar una tarjeta
// a "… Deprecated" y archivarla para volver a crearla con el nombre original dejaba las dos en la
// tabla, y cada plan aparecía duplicado.
//
// `includeArchivedAccounts` existe para la pantalla de detalle de una cuenta, que está acotada a
// una tarjeta y debe seguir mostrando sus planes aunque esté archivada — ahí el usuario navegó a
// propósito a esa tarjeta, y esconderlos haría parecer que los datos se perdieron.
export function useMsiPlans({ includeArchivedAccounts = false }: { includeArchivedAccounts?: boolean } = {}) {
  const [plans, setPlans] = useState<MsiPlan[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select(
        'id, account_id, concepto, monto, nota, fecha, msi_meses, msi_mes_inicio, msi_liquidado_mes, account:accounts(nombre, status)',
      )
      .eq('tipo', 'compra_msi')
      .order('fecha', { ascending: false })
      // La fecha ya no lleva hora: sin desempate, dos movimientos del mismo día salían en orden
      // arbitrario y podían intercambiarse entre consultas.
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    // El filtro va aquí y no en la consulta: con `accounts!inner` + `eq('account.status', …)` un
    // error de sintaxis en el recurso embebido no falla, simplemente deja pasar todo, y el síntoma
    // sería el mismo que se está corrigiendo. El volumen es bajo (ver arriba), así que filtrar en
    // memoria no cuesta nada y no puede fallar en silencio.
    setPlans(
      (data as unknown as MsiPlanRow[])
        .filter((row) => includeArchivedAccounts || row.account?.status === 'active')
        .map((row) => ({
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
  }, [includeArchivedAccounts])

  // RN-332 — ver useAccount: alimenta la misma pantalla y tiene que refrescarse con ella.
  const dataVersion = useDataVersion()
  useEffect(() => {
    refetch()
  }, [refetch, dataVersion])

  return { plans, error, refetch }
}
