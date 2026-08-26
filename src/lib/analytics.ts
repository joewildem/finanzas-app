// RN-262 — % de variación respecto al periodo anterior; `null` si no hay base de comparación
// (periodo "All", o el monto anterior es $0 — RN-263).
export function computeVariation(actual: number, anterior: number | null): number | null {
  if (anterior === null || anterior === 0) return null
  return (actual - anterior) / Math.abs(anterior)
}

export interface PeriodAmount {
  monto: number
  montoAnterior: number | null
  variacion: number | null
}

export function buildPeriodAmount(actual: number, anterior: number | null): PeriodAmount {
  return { monto: actual, montoAnterior: anterior, variacion: computeVariation(actual, anterior) }
}
