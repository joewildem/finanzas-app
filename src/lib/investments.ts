export type InvestmentStatus = 'activo' | 'inactivo'

// RN-142 — catálogos cerrados a nivel de esquema, no administrables por el usuario en esta versión.
export const INVESTMENT_GROUPS = [
  'Large Cap',
  'Small Cap',
  'REIT',
  'Developed Markets',
  'Emerging Markets',
  'Treasury Bonds',
  'Crypto',
  'Retirement',
] as const
export type InvestmentGroup = (typeof INVESTMENT_GROUPS)[number]

export const INVESTMENT_TYPES = [
  'Stock',
  'ETF',
  'Bond',
  'Fund',
  'Crypto',
  'Real Estate',
  'PPR',
] as const
export type InvestmentType = (typeof INVESTMENT_TYPES)[number]

export interface Investment {
  id: string
  user_id: string
  ticker: string
  nombre: string
  grupo_activo: InvestmentGroup
  tipo_activo: InvestmentType
  porcentaje_objetivo: number
  balance_actual: number
  status: InvestmentStatus
  created_at: string
  updated_at: string
}

export interface InvestmentBalanceHistoryRow {
  id: string
  investment_id: string
  fecha: string
  balance: number
}

export const YAHOO_FINANCE_PORTFOLIO_URL = 'https://finance.yahoo.com/portfolios'

function toCents(amount: number): number {
  return Math.round(amount * 100)
}

function fromCents(cents: number): number {
  return cents / 100
}

// RN-146/RN-147.
export function computePortfolioTotals(investments: Investment[]): {
  totalActivo: number
  totalGeneral: number
} {
  return {
    totalActivo: investments.filter((i) => i.status === 'activo').reduce((sum, i) => sum + i.balance_actual, 0),
    totalGeneral: investments.reduce((sum, i) => sum + i.balance_actual, 0),
  }
}

export interface ActiveInvestmentStats {
  investment: Investment
  porcentajeActual: number | undefined
  diferencia: number
}

// RN-148/RN-149 — porcentaje_actual y diferencia se calculan exclusivamente sobre el total activo.
export function computeActiveStats(activeInvestments: Investment[]): ActiveInvestmentStats[] {
  const totalActivo = activeInvestments.reduce((sum, i) => sum + i.balance_actual, 0)
  return activeInvestments.map((investment) => ({
    investment,
    porcentajeActual: totalActivo > 0 ? (investment.balance_actual / totalActivo) * 100 : undefined,
    diferencia: investment.balance_actual - (investment.porcentaje_objetivo / 100) * totalActivo,
  }))
}

export interface InactiveInvestmentStats {
  investment: Investment
  porcentajeDelTotal: number | undefined
}

// RN-150 — informativo, sin regla de negocio asociada.
export function computeInactiveStats(
  inactiveInvestments: Investment[],
  totalGeneral: number,
): InactiveInvestmentStats[] {
  return inactiveInvestments.map((investment) => ({
    investment,
    porcentajeDelTotal: totalGeneral > 0 ? (investment.balance_actual / totalGeneral) * 100 : undefined,
  }))
}

export interface ExposureBreakdownRow {
  key: string
  monto: number
  porcentaje: number | undefined
}

// RN-151 — desglose calculado sobre total_general (activos e inactivos), no sobre el conjunto activo.
export function computeExposureBreakdown(
  investments: Investment[],
  groupBy: 'grupo_activo' | 'tipo_activo',
): ExposureBreakdownRow[] {
  const totalGeneral = investments.reduce((sum, i) => sum + i.balance_actual, 0)
  const totals = new Map<string, number>()
  for (const investment of investments) {
    const key = investment[groupBy]
    totals.set(key, (totals.get(key) ?? 0) + investment.balance_actual)
  }
  return [...totals.entries()]
    .map(([key, monto]) => ({
      key,
      monto,
      porcentaje: totalGeneral > 0 ? (monto / totalGeneral) * 100 : undefined,
    }))
    .sort((a, b) => b.monto - a.monto)
}

// RN-152 — balance_actualizado_en (por instrumento) y ultima_actualizacion_portafolio (global) se
// derivan de MAX(fecha) sobre el historial, calculados en cliente (sin GROUP BY vía PostgREST) dado
// el volumen bajo esperado. Comparación lexicográfica válida porque `fecha` es 'YYYY-MM-DD'.
export function computeBalanceUpdatedDates(history: InvestmentBalanceHistoryRow[]): {
  byInvestment: Map<string, string>
  latest: string | null
} {
  const byInvestment = new Map<string, string>()
  let latest: string | null = null
  for (const row of history) {
    const current = byInvestment.get(row.investment_id)
    if (!current || row.fecha > current) byInvestment.set(row.investment_id, row.fecha)
    if (!latest || row.fecha > latest) latest = row.fecha
  }
  return { byInvestment, latest }
}

export interface ContributionPlanRow {
  investment: Investment
  faltante: number
  aportacionSugerida: number
  nuevoBalance: number
  nuevoPorcentaje: number | undefined
}

export interface ContributionPlanResult {
  totalActivo: number
  totalProyectado: number
  faltanteTotal: number
  rows: ContributionPlanRow[]
}

// RN-172 a RN-178 — simulador efímero de reparto de la siguiente aportación. Todo el cálculo se
// hace en centavos enteros para evitar arrastre de error de punto flotante entre instrumentos; el
// residuo de redondeo (RN-177) se asigna íntegro al instrumento de mayor `faltante`, con empate por
// mayor `porcentaje_objetivo` y luego por `ticker` alfabético menor.
export function computeContributionPlan(
  activeInvestments: Investment[],
  montoAportacion: number,
): ContributionPlanResult {
  const totalActivoCents = activeInvestments.reduce((sum, i) => sum + toCents(i.balance_actual), 0)
  const montoCents = Math.max(0, toCents(montoAportacion))
  const totalProyectadoCents = totalActivoCents + montoCents

  const faltantes = activeInvestments.map((investment) => {
    const objetivoCents = Math.round((investment.porcentaje_objetivo / 100) * totalProyectadoCents)
    return Math.max(0, objetivoCents - toCents(investment.balance_actual))
  })
  const faltanteTotalCents = faltantes.reduce((sum, f) => sum + f, 0)

  const rawCents = activeInvestments.map((investment, i) => {
    if (montoCents <= 0) return 0
    if (montoCents <= faltanteTotalCents) {
      // RN-174 (fase 1 — cubrir faltantes).
      return faltanteTotalCents === 0 ? 0 : Math.round(montoCents * (faltantes[i] / faltanteTotalCents))
    }
    // RN-175 (fase 2 — repartir el remanente por porcentaje objetivo).
    const remanenteCents = montoCents - faltanteTotalCents
    return faltantes[i] + Math.round(remanenteCents * (investment.porcentaje_objetivo / 100))
  })

  const assignedCents = rawCents.reduce((sum, c) => sum + c, 0)
  const residualCents = montoCents - assignedCents

  if (residualCents !== 0 && activeInvestments.length > 0) {
    let winnerIdx = 0
    for (let i = 1; i < activeInvestments.length; i++) {
      const current = activeInvestments[winnerIdx]
      const candidate = activeInvestments[i]
      const currentWins =
        faltantes[i] > faltantes[winnerIdx] ||
        (faltantes[i] === faltantes[winnerIdx] && candidate.porcentaje_objetivo > current.porcentaje_objetivo) ||
        (faltantes[i] === faltantes[winnerIdx] &&
          candidate.porcentaje_objetivo === current.porcentaje_objetivo &&
          candidate.ticker.localeCompare(current.ticker) < 0)
      if (currentWins) winnerIdx = i
    }
    rawCents[winnerIdx] += residualCents
  }

  const rows: ContributionPlanRow[] = activeInvestments.map((investment, i) => {
    const nuevoBalanceCents = toCents(investment.balance_actual) + rawCents[i]
    return {
      investment,
      faltante: fromCents(faltantes[i]),
      aportacionSugerida: fromCents(rawCents[i]),
      nuevoBalance: fromCents(nuevoBalanceCents),
      nuevoPorcentaje: totalProyectadoCents > 0 ? (nuevoBalanceCents / totalProyectadoCents) * 100 : undefined,
    }
  })

  return {
    totalActivo: fromCents(totalActivoCents),
    totalProyectado: fromCents(totalProyectadoCents),
    faltanteTotal: fromCents(faltanteTotalCents),
    rows,
  }
}
