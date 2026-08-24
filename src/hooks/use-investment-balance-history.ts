import { useCallback, useEffect, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { InvestmentBalanceHistoryRow } from '@/lib/investments'

// RN-152 — trae todo el historial del usuario en una sola consulta (mismo criterio de volumen bajo
// que justifica no paginar en el resto del módulo); la página reduce esto a la fecha máxima por
// instrumento y global vía computeBalanceUpdatedDates. Sin pantalla propia (RN-166) — este hook
// nunca se usa para listar movimientos, solo para derivar "última actualización".
export function useInvestmentBalanceHistory() {
  const [history, setHistory] = useState<InvestmentBalanceHistoryRow[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from('investment_balance_history').select('id, investment_id, fecha, balance')
    if (error) {
      setError(error.message)
      return
    }
    setError(null)
    setHistory(data as InvestmentBalanceHistoryRow[])
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { history, error, refetch }
}
