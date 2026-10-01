import { useCallback, useEffect, useState } from 'react'
import { addMonths, format, startOfMonth, subMonths } from 'date-fns'

import { useDataVersion } from '@/hooks/use-data-version'
import { useMsiPlans } from '@/hooks/use-msi-plans'
import type { Account } from '@/lib/accounts'
import { formatDateParam, parseDate } from '@/lib/dates'
import { computeInstallmentForMonth } from '@/lib/msi'
import { paymentAppliesToMonth, paymentMonthOf } from '@/lib/statements'
import { supabase } from '@/lib/supabase'

export interface CardDue {
  accountId: string
  nombre: string
  color: string
  total: number
  pagado: number
  pendiente: number
}

export interface MonthDue {
  mes: string
  total: number
  pendiente: number
  porTarjeta: CardDue[]
}

export interface CreditCardsDue {
  /** El mes más próximo que todavía tiene algo por pagar. `null` si no se debe nada. */
  aPagar: MonthDue | null
  /** El mes siguiente a ese: lo que se va acumulando y todavía no toca pagar. */
  acumulando: MonthDue | null
}

// Cuántos meses hacia atrás se traen movimientos. Un gasto tarda hasta dos meses en volverse pago
// (compra del 20 de agosto → corte del 16 de septiembre → pago el 6 de octubre), así que con cuatro
// sobra para resolver el mes en curso y el siguiente.
const MESES_DE_HISTORIA = 4

// CU-063 — "¿cuánto tengo que pagarle a mis tarjetas?", que es una pregunta distinta de "¿cuánto
// debo?" (RN-241, el total de saldos). Lo que se paga en un mes es lo que cerró en su periodo de
// facturación, no lo que se gastó en el mes natural (RN-348), más las parcialidades de MSI que
// corren ese mes, menos lo que ya se abonó.
//
// El mes que se muestra NO es fijo: es el primero que todavía tiene pendiente. Así, en cuanto el
// usuario paga sus tarjetas a principios de octubre, el indicador deja de mostrar octubre y pasa a
// noviembre solo, sin que haya que marcar nada a mano.
export function useCreditCardsDue(creditAccounts: Account[]) {
  const { plans } = useMsiPlans()
  const [due, setDue] = useState<CreditCardsDue | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const accountIdsKey = creditAccounts.map((a) => a.id).join(',')

  const refetch = useCallback(async () => {
    if (creditAccounts.length === 0 || !plans) {
      if (creditAccounts.length === 0) setDue({ aPagar: null, acumulando: null })
      return
    }

    const desde = formatDateParam(startOfMonth(subMonths(new Date(), MESES_DE_HISTORIA)))
    const { data, error: txError } = await supabase
      .from('transactions')
      .select('account_id, tipo, monto, fecha')
      // RN-355: los ajustes cuentan aquí — son dinero cargado a la tarjeta, solo que sin categoría.
      .in('tipo', ['gasto', 'ajuste', 'pago_tarjeta'])
      .in(
        'account_id',
        creditAccounts.map((a) => a.id),
      )
      .gte('fecha', desde)

    if (txError) {
      setError(txError.message)
      return
    }
    setError(null)

    const txs = data as { account_id: string; tipo: string; monto: number; fecha: string }[]

    function buildMonth(mes: string): MonthDue {
      const porTarjeta = creditAccounts.map((account) => {
        const ciclo =
          account.dia_corte != null && account.dia_pago != null
            ? { diaCorte: account.dia_corte, diaPago: account.dia_pago }
            : null

        const propias = txs.filter((t) => t.account_id === account.id)

        const compras = propias
          .filter(
            (t) =>
              (t.tipo === 'gasto' || t.tipo === 'ajuste') &&
              (ciclo ? paymentMonthOf(parseDate(t.fecha), ciclo.diaCorte, ciclo.diaPago) : t.fecha.slice(0, 7)) === mes,
          )
          // `-monto` y no `Math.abs`: un ajuste puede ir en cualquier dirección, y en valor
          // absoluto una corrección a la baja sumaría deuda en vez de restarla.
          .reduce((sum, t) => sum - t.monto, 0)

        const mensualidades = plans!
          .filter((plan) => plan.accountId === account.id)
          .reduce((sum, plan) => sum + (computeInstallmentForMonth(plan, mes) ?? 0), 0)

        const pagado = propias
          .filter(
            (t) =>
              t.tipo === 'pago_tarjeta' &&
              (ciclo ? paymentAppliesToMonth(parseDate(t.fecha), ciclo.diaCorte, ciclo.diaPago) : t.fecha.slice(0, 7)) ===
                mes,
          )
          .reduce((sum, t) => sum + Math.abs(t.monto), 0)

        const total = compras + mensualidades
        return {
          accountId: account.id,
          nombre: account.nombre,
          color: account.color,
          total,
          pagado,
          // Un sobrepago no deja el pendiente en negativo ni resta del total de las demás tarjetas.
          pendiente: Math.max(0, total - pagado),
        }
      })

      return {
        mes,
        total: porTarjeta.reduce((sum, c) => sum + c.total, 0),
        pendiente: porTarjeta.reduce((sum, c) => sum + c.pendiente, 0),
        porTarjeta,
      }
    }

    // Se busca desde el mes en curso hacia adelante. Un mes ya pagado se salta, que es justo lo que
    // hace rodar el indicador al siguiente sin intervención.
    const hoy = new Date()
    const candidatos = Array.from({ length: 4 }, (_, i) => format(addMonths(hoy, i), 'yyyy-MM')).map(buildMonth)
    const aPagar = candidatos.find((m) => m.pendiente > 0) ?? null
    const acumulando = aPagar ? buildMonth(format(addMonths(parseDate(`${aPagar.mes}-01`), 1), 'yyyy-MM')) : null

    setDue({ aPagar, acumulando })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIdsKey, plans])

  const dataVersion = useDataVersion()
  useEffect(() => {
    refetch()
  }, [refetch, dataVersion])

  return { due, error, refetch }
}
